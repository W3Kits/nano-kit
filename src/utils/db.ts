import { openDB, deleteDB, DBSchema, IDBPDatabase } from 'idb'
import type { Session, Message } from '../types'
import { deletePersistentJson, readPersistentJson, writePersistentJson } from '@/lib/persistent-json'
import { isW3KitsRuntime } from '@/lib/w3kits-runtime'

interface GeminiDB extends DBSchema {
  sessions: {
    key: number
    value: Session
  }
  messages: {
    key: number
    value: Message
    indexes: { 'sessionId': number }
  }
}

interface W3KitsDbSnapshot {
  sessions: Session[]
  messages: Message[]
  nextMessageId: number
}

const DB_NAME = 'GeminiProDB'
const DB_VERSION = 2
const W3KITS_DB_PATH = 'state/chat-db.json'

let db: IDBPDatabase<GeminiDB> | null = null
let initPromise: Promise<IDBPDatabase<GeminiDB>> | null = null
let blockedHandler: (() => void) | null = null
let runtimeSnapshotPromise: Promise<W3KitsDbSnapshot> | null = null

function defaultRuntimeSnapshot(): W3KitsDbSnapshot {
  return {
    sessions: [],
    messages: [],
    nextMessageId: 1
  }
}

async function readRuntimeSnapshot(): Promise<W3KitsDbSnapshot> {
  if (!isW3KitsRuntime()) return defaultRuntimeSnapshot()
  if (!runtimeSnapshotPromise) {
    runtimeSnapshotPromise = readPersistentJson<W3KitsDbSnapshot>(W3KITS_DB_PATH, defaultRuntimeSnapshot())
      .then((snapshot) => {
        if (!snapshot || typeof snapshot !== 'object') return defaultRuntimeSnapshot()
        return {
          sessions: Array.isArray(snapshot.sessions) ? snapshot.sessions : [],
          messages: Array.isArray(snapshot.messages) ? snapshot.messages : [],
          nextMessageId: typeof snapshot.nextMessageId === 'number' && snapshot.nextMessageId > 0 ? snapshot.nextMessageId : 1
        }
      })
  }
  return runtimeSnapshotPromise
}

async function mutateRuntimeSnapshot<T>(mutator: (snapshot: W3KitsDbSnapshot) => T | Promise<T>): Promise<T> {
  const snapshot = await readRuntimeSnapshot()
  const nextSnapshot: W3KitsDbSnapshot = {
    sessions: snapshot.sessions.map((session) => ({ ...session })),
    messages: snapshot.messages.map((message) => ({ ...message, images: [...message.images] })),
    nextMessageId: snapshot.nextMessageId
  }
  const result = await mutator(nextSnapshot)
  runtimeSnapshotPromise = Promise.resolve(nextSnapshot)
  await writePersistentJson(W3KITS_DB_PATH, nextSnapshot)
  return result
}

export function setDBBlockedHandler(handler: (() => void) | null) {
  blockedHandler = handler
}

export async function initDB(): Promise<IDBPDatabase<GeminiDB> | null> {
  if (isW3KitsRuntime()) {
    await readRuntimeSnapshot()
    return null
  }

  if (db) return db
  if (initPromise) return initPromise

  initPromise = openDB<GeminiDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('sessions')) {
        database.createObjectStore('sessions', { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains('messages')) {
        const msgStore = database.createObjectStore('messages', { keyPath: 'id', autoIncrement: true })
        msgStore.createIndex('sessionId', 'sessionId', { unique: false })
      }
    },
    blocked() {
      blockedHandler?.()
    }
  })
    .then((database) => {
      db = database
      return database
    })
    .catch((error) => {
      db = null
      initPromise = null
      throw error
    })

  return initPromise
}

export async function getAllSessions(): Promise<Session[]> {
  if (isW3KitsRuntime()) {
    const snapshot = await readRuntimeSnapshot()
    return [...snapshot.sessions].sort((a, b) => b.id - a.id)
  }

  const database = await initDB()
  const sessions = await database!.getAll('sessions')
  return sessions.sort((a, b) => b.id - a.id)
}

export async function getSessionMessages(sessionId: number): Promise<Message[]> {
  if (isW3KitsRuntime()) {
    const snapshot = await readRuntimeSnapshot()
    return snapshot.messages.filter((message) => message.sessionId === sessionId)
  }

  const database = await initDB()
  return database!.getAllFromIndex('messages', 'sessionId', sessionId)
}

export async function getMessage(messageId: number): Promise<Message | undefined> {
  if (isW3KitsRuntime()) {
    const snapshot = await readRuntimeSnapshot()
    return snapshot.messages.find((message) => message.id === messageId)
  }

  const database = await initDB()
  return database!.get('messages', messageId)
}

export async function saveMessage(
  sessionId: number,
  role: 'user' | 'bot',
  content: string,
  images: string[] = [],
  rawHtml: string | null = null
): Promise<number> {
  if (isW3KitsRuntime()) {
    return mutateRuntimeSnapshot((snapshot) => {
      const id = snapshot.nextMessageId++
      snapshot.messages.push({
        id,
        sessionId,
        role,
        content,
        images,
        rawHtml,
        timestamp: Date.now()
      })
      return id
    })
  }

  const database = await initDB()
  const id = await database!.add('messages', {
    sessionId,
    role,
    content,
    images,
    rawHtml,
    timestamp: Date.now()
  } as Message)
  return id as number
}

export async function createSession(title: string = '新对话'): Promise<number> {
  if (isW3KitsRuntime()) {
    return mutateRuntimeSnapshot((snapshot) => {
      const id = Date.now()
      snapshot.sessions.push({
        id,
        title,
        timestamp: id
      })
      return id
    })
  }

  const database = await initDB()
  const id = Date.now()
  await database!.add('sessions', {
    id,
    title,
    timestamp: id
  })
  return id
}

export async function deleteSession(sessionId: number): Promise<void> {
  if (isW3KitsRuntime()) {
    await mutateRuntimeSnapshot((snapshot) => {
      snapshot.sessions = snapshot.sessions.filter((session) => session.id !== sessionId)
      snapshot.messages = snapshot.messages.filter((message) => message.sessionId !== sessionId)
    })
    return
  }

  const database = await initDB()
  await database!.delete('sessions', sessionId)

  const tx = database!.transaction('messages', 'readwrite')
  const index = tx.store.index('sessionId')
  try {
    let cursor = await index.openCursor(sessionId)
    while (cursor) {
      await cursor.delete()
      cursor = await cursor.continue()
    }
  } finally {
    await tx.done
  }
}

export async function deleteMessage(messageId: number): Promise<void> {
  if (isW3KitsRuntime()) {
    await mutateRuntimeSnapshot((snapshot) => {
      snapshot.messages = snapshot.messages.filter((message) => message.id !== messageId)
    })
    return
  }

  const database = await initDB()
  await database!.delete('messages', messageId)
}

export async function updateMessage(message: Message): Promise<void> {
  if (!message.id) {
    throw new Error('Missing message id')
  }

  if (isW3KitsRuntime()) {
    await mutateRuntimeSnapshot((snapshot) => {
      const index = snapshot.messages.findIndex((entry) => entry.id === message.id)
      if (index >= 0) snapshot.messages[index] = message
    })
    return
  }

  const database = await initDB()
  await database!.put('messages', message)
}

export async function updateSessionTitle(sessionId: number, title: string): Promise<void> {
  if (isW3KitsRuntime()) {
    await mutateRuntimeSnapshot((snapshot) => {
      const session = snapshot.sessions.find((entry) => entry.id === sessionId)
      if (session) session.title = title
    })
    return
  }

  const database = await initDB()
  const session = await database!.get('sessions', sessionId)
  if (session) {
    session.title = title
    await database!.put('sessions', session)
  }
}

export async function resetDB(): Promise<void> {
  if (isW3KitsRuntime()) {
    runtimeSnapshotPromise = Promise.resolve(defaultRuntimeSnapshot())
    await deletePersistentJson(W3KITS_DB_PATH)
    return
  }

  if (db) {
    db.close()
    db = null
  }
  initPromise = null
  await deleteDB(DB_NAME)
}
