import {
  deleteW3KitsStorage,
  isW3KitsRuntime,
  readW3KitsStorage,
  syncW3KitsStorage,
  writeW3KitsStorage
} from './w3kits-runtime'

const LOCAL_FILE_PREFIX = 'nano-kit:file:'

function localFileKey(path: string): string {
  return `${LOCAL_FILE_PREFIX}${path}`
}

export async function readPersistentJson<T>(path: string, fallback: T): Promise<T> {
  if (isW3KitsRuntime()) {
    const entry = await readW3KitsStorage(path)
    if (!entry?.body) return fallback
    try {
      return JSON.parse(entry.body) as T
    } catch {
      return fallback
    }
  }

  try {
    const raw = localStorage.getItem(localFileKey(path))
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export async function writePersistentJson(path: string, value: unknown): Promise<void> {
  const text = JSON.stringify(value)
  if (isW3KitsRuntime()) {
    await writeW3KitsStorage(path, text, 'application/json;charset=UTF-8')
    await syncW3KitsStorage().catch(() => undefined)
    return
  }

  localStorage.setItem(localFileKey(path), text)
}

export async function deletePersistentJson(path: string): Promise<void> {
  if (isW3KitsRuntime()) {
    await deleteW3KitsStorage(path)
    await syncW3KitsStorage().catch(() => undefined)
    return
  }

  localStorage.removeItem(localFileKey(path))
}
