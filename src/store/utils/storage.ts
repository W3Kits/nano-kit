import { readPersistentJson, writePersistentJson } from '@/lib/persistent-json'

type StorageWrite = {
  key: string
  value: string
  onError?: (error: unknown) => void
}

const STORAGE_PATH = 'state/app-kv.json'

const pendingWrites = new Map<string, StorageWrite>()
let flushHandle: number | null = null
let hydratedValues: Record<string, string> | null = null
let hydrationPromise: Promise<void> | null = null

const scheduleIdle = (cb: () => void) => {
  if (typeof window === 'undefined') {
    return setTimeout(cb, 0)
  }

  const w = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  }

  if (typeof w.requestIdleCallback === 'function') {
    return w.requestIdleCallback(() => cb(), { timeout: 1000 })
  }

  return window.setTimeout(cb, 0)
}

function snapshotLocalStorage(): Record<string, string> {
  const values: Record<string, string> = {}
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key) continue
      const value = localStorage.getItem(key)
      if (value != null) values[key] = value
    }
  } catch {
    return {}
  }
  return values
}

const flushWrites = async () => {
  flushHandle = null
  const writes = Array.from(pendingWrites.values())
  pendingWrites.clear()

  if (!hydratedValues) hydratedValues = snapshotLocalStorage()

  for (const write of writes) {
    try {
      hydratedValues[write.key] = write.value
      localStorage.setItem(write.key, write.value)
    } catch (error) {
      write.onError?.(error)
    }
  }

  try {
    await writePersistentJson(STORAGE_PATH, hydratedValues)
  } catch (error) {
    for (const write of writes) write.onError?.(error)
  }
}

export const scheduleStorageWrite = (key: string, value: string, onError?: (error: unknown) => void) => {
  pendingWrites.set(key, { key, value, onError })
  if (!hydratedValues) hydratedValues = snapshotLocalStorage()
  hydratedValues[key] = value
  if (flushHandle !== null) return
  flushHandle = scheduleIdle(() => {
    void flushWrites()
  })
}

export const safeStorageGet = (key: string): string | null => {
  if (hydratedValues && Object.prototype.hasOwnProperty.call(hydratedValues, key)) {
    return hydratedValues[key] ?? null
  }
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export async function hydratePersistentStorage(): Promise<void> {
  if (hydrationPromise) return hydrationPromise
  hydrationPromise = (async () => {
    const persisted = await readPersistentJson<Record<string, string>>(STORAGE_PATH, {})
    hydratedValues = persisted && typeof persisted === 'object' ? persisted : {}
    for (const [key, value] of Object.entries(hydratedValues)) {
      try {
        localStorage.setItem(key, value)
      } catch {
        // ignore local mirroring failures
      }
    }
  })().finally(() => {
    hydrationPromise = null
  })
  return hydrationPromise
}
