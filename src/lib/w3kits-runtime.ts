export const W3KITS_PLUGIN_ID = 'nano-kit'
export const W3KITS_DEFAULT_TEXT_MODEL = 'gpt-5.4-mini'
export const W3KITS_DEFAULT_IMAGE_MODEL = 'gpt-image-2'
export const W3KITS_MANAGED_OPENAI_KEY = '__w3kits_runtime__'

const W3KITS_BRIDGE_VERSION = 1
const W3KITS_RESPONSE = 'W3KITS_RESPONSE'
const W3KITS_AUTH_REQUIRED = 'W3KITS_AUTH_REQUIRED'
const W3KITS_RUNTIME_SESSION_REQUEST = 'W3KITS_RUNTIME_SESSION_REQUEST'
const W3KITS_STORAGE_READ = 'W3KITS_STORAGE_READ'
const W3KITS_STORAGE_WRITE = 'W3KITS_STORAGE_WRITE'
const W3KITS_STORAGE_DELETE = 'W3KITS_STORAGE_DELETE'
const W3KITS_STORAGE_LIST = 'W3KITS_STORAGE_LIST'
const W3KITS_STORAGE_SYNC = 'W3KITS_STORAGE_SYNC'

export interface W3KitsRuntimeSession {
  token: string
  expiresIn: number
  pluginId: string
  pluginVersion: string
  packageName?: string
  packageIntegrity?: string
  openaiBaseUrl: string
  runtimeSessionHeader: string
  identityHeaders: Record<string, string | undefined>
}

interface BridgeErrorShape {
  code?: unknown
  message?: unknown
}

interface BridgeResponse<T> {
  type?: unknown
  requestId?: unknown
  ok?: unknown
  data?: T
  error?: BridgeErrorShape
}

interface StorageReadResult {
  body?: string
  contentType?: string
  etag?: string
  revision?: string
  temporary?: boolean
}

interface StorageWriteResult {
  metadata?: {
    path: string
    size: number
    etag: string
    revision: string
    updatedAt: string
    contentType?: string
  }
}

let cachedRuntimeSession: { value: W3KitsRuntimeSession; expiresAt: number } | null = null

function queryParam(name: string): string | null {
  if (typeof window === 'undefined') return null
  return new URL(window.location.href).searchParams.get(name)
}

export function isW3KitsRuntime(): boolean {
  if (typeof window === 'undefined') return false
  if (window.parent !== window) return true
  return Boolean(queryParam('w3kitsParentOrigin') || queryParam('w3kitsOpenAiBaseUrl') || queryParam('openaiBaseUrl'))
}

export function getW3KitsOpenAiBaseUrl(): string {
  if (typeof window === 'undefined') return 'https://w3kits.com/api/ai/openai/v1'
  return (
    queryParam('openaiBaseUrl') ||
    queryParam('w3kitsOpenAiBaseUrl') ||
    'https://w3kits.com/api/ai/openai/v1'
  ).replace(/\/+$/, '')
}

export function isManagedOpenAiProvider(input: { type?: string; host?: string; key?: string } | null | undefined): boolean {
  if (!input || input.type !== 'openai') return false
  return (input.key || '').trim() === W3KITS_MANAGED_OPENAI_KEY
}

function getW3KitsParentOrigin(): string {
  if (typeof window === 'undefined') return 'https://w3kits.com'
  const parentOrigin = queryParam('w3kitsParentOrigin')
  if (parentOrigin) return parentOrigin
  try {
    return new URL(getW3KitsOpenAiBaseUrl()).origin
  } catch {
    return 'https://w3kits.com'
  }
}

function getBridgeErrorMessage(error: BridgeErrorShape | undefined): string {
  if (typeof error?.message === 'string' && error.message) return error.message
  if (typeof error?.code === 'string' && error.code) return error.code
  return 'W3Kits runtime bridge failed.'
}

function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return message.includes('not_found') || message.includes('not found')
}

function bridgeRequest<T>(message: Record<string, unknown>, timeoutMs = 10000): Promise<T> {
  if (typeof window === 'undefined' || window.parent === window) {
    return Promise.reject(new Error('W3Kits runtime bridge is unavailable.'))
  }

  const requestId = `nano-kit-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const parentOrigin = getW3KitsParentOrigin()

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onMessage)
      reject(new Error('W3Kits runtime bridge timed out.'))
    }, timeoutMs)

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return
      if (event.origin !== parentOrigin) return

      const data = event.data as BridgeResponse<T>
      if (data?.type !== W3KITS_RESPONSE || data.requestId !== requestId) return

      window.clearTimeout(timeout)
      window.removeEventListener('message', onMessage)

      if (data.ok) resolve(data.data as T)
      else reject(new Error(getBridgeErrorMessage(data.error)))
    }

    window.addEventListener('message', onMessage)
    window.parent.postMessage({ ...message, version: W3KITS_BRIDGE_VERSION, requestId }, parentOrigin)
  })
}

export function isW3KitsLoginRequired(payload: unknown, status?: number): boolean {
  if (status === 401) return true
  if (!payload || typeof payload !== 'object') return false
  const record = payload as Record<string, unknown>
  const error = record.error
  if (error && typeof error === 'object') {
    const code = (error as Record<string, unknown>).code
    return code === 'login_required' || code === 'plugin_runtime_session_required' || code === 'invalid_plugin_runtime_session'
  }
  return record.error === 'login_required' || record.code === 'login_required'
}

export function requestW3KitsLogin(reason = 'ai_request') {
  if (typeof window === 'undefined' || window.parent === window) return
  window.parent.postMessage(
    {
      type: W3KITS_AUTH_REQUIRED,
      version: W3KITS_BRIDGE_VERSION,
      pluginId: W3KITS_PLUGIN_ID,
      reason
    },
    getW3KitsParentOrigin()
  )
}

export async function getW3KitsRuntimeSession(): Promise<W3KitsRuntimeSession> {
  const now = Date.now()
  if (cachedRuntimeSession && cachedRuntimeSession.expiresAt - now > 30000) {
    return cachedRuntimeSession.value
  }

  const session = await bridgeRequest<W3KitsRuntimeSession>({
    type: W3KITS_RUNTIME_SESSION_REQUEST,
    pluginId: W3KITS_PLUGIN_ID,
    origin: typeof window === 'undefined' ? undefined : window.location.origin
  })

  cachedRuntimeSession = {
    value: session,
    expiresAt: now + Math.max(30, session.expiresIn - 30) * 1000
  }
  return session
}

export async function getW3KitsOpenAiHeaders(): Promise<Record<string, string>> {
  const session = await getW3KitsRuntimeSession()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-w3kits-runtime-session': session.token,
    'x-w3kits-plugin-id': session.pluginId || W3KITS_PLUGIN_ID,
    'x-w3kits-plugin-version': session.pluginVersion
  }

  for (const [key, value] of Object.entries(session.identityHeaders || {})) {
    if (typeof value === 'string' && value) headers[key] = value
  }

  if (session.packageName) headers['x-w3kits-plugin-package'] = session.packageName
  if (session.packageIntegrity) headers['x-w3kits-plugin-integrity'] = session.packageIntegrity
  return headers
}

export async function readW3KitsStorage(path: string): Promise<StorageReadResult | null> {
  try {
    return await bridgeRequest<StorageReadResult>({
      type: W3KITS_STORAGE_READ,
      pluginId: W3KITS_PLUGIN_ID,
      path
    })
  } catch (error) {
    if (isNotFoundError(error)) return null
    throw error
  }
}

export async function writeW3KitsStorage(path: string, body: string, contentType = 'text/plain;charset=UTF-8'): Promise<StorageWriteResult> {
  return bridgeRequest<StorageWriteResult>({
    type: W3KITS_STORAGE_WRITE,
    pluginId: W3KITS_PLUGIN_ID,
    path,
    body,
    contentType
  })
}

export async function deleteW3KitsStorage(path: string): Promise<{ deleted?: boolean } | null> {
  try {
    return await bridgeRequest<{ deleted?: boolean }>({
      type: W3KITS_STORAGE_DELETE,
      pluginId: W3KITS_PLUGIN_ID,
      path
    })
  } catch (error) {
    if (isNotFoundError(error)) return { deleted: false }
    throw error
  }
}

export async function listW3KitsStorage(path = ''): Promise<Array<{ path: string; kind?: string }>> {
  const response = await bridgeRequest<{ entries?: Array<{ path: string; kind?: string }> }>({
    type: W3KITS_STORAGE_LIST,
    pluginId: W3KITS_PLUGIN_ID,
    path
  })
  return Array.isArray(response.entries) ? response.entries : []
}

export async function syncW3KitsStorage(): Promise<{ queued?: boolean; temporary?: boolean }> {
  return bridgeRequest<{ queued?: boolean; temporary?: boolean }>({
    type: W3KITS_STORAGE_SYNC,
    pluginId: W3KITS_PLUGIN_ID
  })
}
