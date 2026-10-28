import type { ErrorBody, FieldErrors } from './types'

type Method = 'GET' | 'POST' | 'PUT'

export class ApiError extends Error {
  constructor(
    public status: number,
    public type: string,
    message: string,
    public payload: FieldErrors = {},
  ) {
    super(message)
  }
}

const isStatus = (e: unknown, status: number) => e instanceof ApiError && e.status === status

// Generated once, stored in localStorage.
const FINGERPRINT_KEY = 'fingerprint'

function getFingerprint(): string {
  let value = localStorage.getItem(FINGERPRINT_KEY)
  if (!value || !/^[0-9a-f]{32}$/.test(value)) {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    value = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    localStorage.setItem(FINGERPRINT_KEY, value)
  }
  return value
}

export const fingerprint = getFingerprint()

const XHR_HEADER = { 'X-Requested-With': 'XMLHttpRequest' }
const toUrl = (path: string) => new URL(path, window.location.origin).href

// One shared GET /csrf for parallel requests.
let csrfPromise: Promise<string> | null = null

function loadCsrf(): Promise<string> {
  csrfPromise = fetch(toUrl('/csrf'), { headers: XHR_HEADER })
    .then((res) => {
      const token = res.headers.get('X-CSRF-TOKEN')
      if (!res.ok || !token) throw new ApiError(res.status, 'CsrfError', 'Failed to get CSRF token')
      return token
    })
    .catch((e: unknown) => {
      csrfPromise = null
      throw e
    })
  return csrfPromise
}

// One request. On 419: refresh CSRF and retry once.
async function send<T>(method: Method, path: string, body?: unknown, csrfRetried = false): Promise<T> {
  const csrf = await (csrfPromise ?? loadCsrf())
  const headers: Record<string, string> = { ...XHR_HEADER }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') headers['X-CSRF-TOKEN'] = csrf
  // Mock accepts any captcha value.
  if (path === '/auth/login') headers['X-Captcha-Token'] = 'mock-captcha'

  const res = await fetch(toUrl(path), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (res.status === 419 && !csrfRetried) {
    await loadCsrf()
    return send<T>(method, path, body, true)
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as ErrorBody | null
    throw new ApiError(
      res.status,
      data?.error.type ?? 'UnknownError',
      data?.error.message ?? res.statusText,
      data?.error.payload,
    )
  }
  // Body can be empty.
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

let onSessionExpired: () => void = () => {}
export function setOnSessionExpired(handler: () => void) {
  onSessionExpired = handler
}

// Parallel 401s share one rotate.
let rotatePromise: Promise<void> | null = null
// If a rotate already happened, just retry.
let rotations = 0

function rotate(): Promise<void> {
  rotatePromise ??= send<void>('POST', '/auth/token/rotate', { fingerprint })
    .then(() => {
      rotations++
    })
    .finally(() => {
      rotatePromise = null
    })
  return rotatePromise
}

// For /v1/*. On 401: rotate, retry once, otherwise log out.
export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const rotationsAtStart = rotations
  try {
    return await send<T>(method, path, body)
  } catch (e) {
    if (!isStatus(e, 401)) throw e
  }

  try {
    if (rotationsAtStart === rotations) await rotate()
  } catch (e) {
    onSessionExpired()
    throw e
  }

  try {
    return await send<T>(method, path, body)
  } catch (e) {
    if (isStatus(e, 401)) onSessionExpired()
    throw e
  }
}

export const authApi = {
  login: (email: string, password: string) =>
    send<{ device_session_token: string }>('POST', '/auth/login', { email, password, fingerprint }),
  issue: (device_session_token: string) =>
    send<void>('POST', '/auth/token/issue', { device_session_token, fingerprint }),
  revoke: () => send<void>('POST', '/auth/token/revoke', { fingerprint }),
}
