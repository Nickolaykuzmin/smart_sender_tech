import { http, HttpResponse } from 'msw'
import type { FieldErrors, User, Webhook } from '../api/types'

export const TEST_EMAIL = 'smart_sender@example.com'
export const TEST_PASSWORD = 'password123'
const CSRF_TOKEN = 'mock-csrf-token'
const SESSION_TTL_MS = 30_000

const ERROR_TYPES: Record<number, string> = {
  400: 'BadRequestException',
  401: 'AuthenticationException',
  404: 'NotFoundException',
  419: 'TokenMismatchException',
  422: 'ValidationException',
}

const MESSAGES: Record<number, string> = {
  400: 'Bad request.',
  401: 'Unauthenticated.',
  404: 'Not found.',
  419: 'CSRF token mismatch.',
  422: 'The given data was invalid.',
}

const error = (status: number, payload?: FieldErrors) =>
  HttpResponse.json(
    { error: { type: ERROR_TYPES[status], message: MESSAGES[status], ...(payload && { payload }) } },
    { status },
  )

const user: User = { id: 1, email: TEST_EMAIL, first_name: 'Demo', last_name: 'User', name: 'Demo User' }

export function createHandlers() {
  const webhooks: Webhook[] = Array.from({ length: 28 }, (_, i) => ({
    id: i + 1,
    name: `${['Orders', 'Payments', 'Leads', 'Support'][i % 4]} hook ${i + 1}`,
    url: `https://example.com/hooks/${i + 1}`,
    active: i % 3 !== 0,
    created_at: new Date(Date.UTC(2024, 0, i + 1)).toISOString(),
  }))

  // Like an HttpOnly cookie: the client never sees the session.
  const deviceTokens = new Map<string, string>() // token -> fingerprint
  let session: { fingerprint: string; expiresAt: number } | null = null

  const csrfInvalid = (req: Request) => req.headers.get('X-CSRF-TOKEN') !== CSRF_TOKEN
  const authed = () => session !== null && Date.now() < session.expiresAt

  return [
    http.get('/csrf', () => new HttpResponse(null, { status: 204, headers: { 'X-CSRF-TOKEN': CSRF_TOKEN } })),

    http.post('/auth/login', async ({ request }) => {
      if (csrfInvalid(request)) return error(419)
      if (!request.headers.get('X-Captcha-Token')) return error(422, { captcha: ['Captcha is required.'] })
      const body = (await request.json()) as { email?: string; password?: string; fingerprint?: string }
      if (body.email !== TEST_EMAIL || body.password !== TEST_PASSWORD || !body.fingerprint) {
        return error(422, { email: ['These credentials do not match our records.'] })
      }
      const token = crypto.randomUUID()
      deviceTokens.set(token, body.fingerprint)
      return HttpResponse.json({ device_session_token: token })
    }),

    http.post('/auth/token/issue', async ({ request }) => {
      if (csrfInvalid(request)) return error(419)
      const body = (await request.json()) as { device_session_token?: string; fingerprint?: string }
      const fp = body.device_session_token && deviceTokens.get(body.device_session_token)
      if (!fp || fp !== body.fingerprint) return error(422, { device_session_token: ['Invalid token.'] })
      deviceTokens.delete(body.device_session_token!)
      session = { fingerprint: fp, expiresAt: Date.now() + SESSION_TTL_MS }
      return new HttpResponse(null, { status: 200 })
    }),

    http.post('/auth/token/rotate', async ({ request }) => {
      if (csrfInvalid(request)) return error(419)
      const body = (await request.json()) as { fingerprint?: string }
      if (!session || session.fingerprint !== body.fingerprint) return error(400)
      session.expiresAt = Date.now() + SESSION_TTL_MS
      return new HttpResponse(null, { status: 200 })
    }),

    http.post('/auth/token/revoke', ({ request }) => {
      if (csrfInvalid(request)) return error(419)
      session = null
      return new HttpResponse(null, { status: 204 })
    }),

    http.get('/v1/me', () => (authed() ? HttpResponse.json(user) : error(401))),

    http.get('/v1/webhooks', ({ request }) => {
      if (!authed()) return error(401)
      const params = new URL(request.url).searchParams
      const page = Math.max(1, Number(params.get('page')) || 1)
      const limit = Math.max(1, Number(params.get('limit')) || 10)
      const search = (params.get('search') ?? '').toLowerCase()

      const filtered = webhooks.filter((w) => w.name.toLowerCase().includes(search))
      return HttpResponse.json({
        data: filtered.slice((page - 1) * limit, page * limit),
        paging: {
          pages: { current: page, last: Math.max(1, Math.ceil(filtered.length / limit)) },
          results: { total: filtered.length, limitation: limit },
        },
      })
    }),

    http.get('/v1/webhooks/:id', ({ params }) => {
      if (!authed()) return error(401)
      const webhook = webhooks.find((w) => w.id === Number(params.id))
      return webhook ? HttpResponse.json(webhook) : error(404)
    }),

    http.put('/v1/webhooks/:id', async ({ request, params }) => {
      if (csrfInvalid(request)) return error(419)
      if (!authed()) return error(401)
      const webhook = webhooks.find((w) => w.id === Number(params.id))
      if (!webhook) return error(404)

      const body = (await request.json()) as { name?: string; url?: string }
      const name = body.name?.trim() ?? ''
      const url = body.url?.trim() ?? ''
      const errors: FieldErrors = {}
      if (!name) errors.name = ['The name field is required.']
      if (!isHttpUrl(url)) errors.url = ['The url must be a valid URL.']
      if (Object.keys(errors).length) return error(422, errors)

      Object.assign(webhook, { name, url })
      return HttpResponse.json(webhook)
    }),
  ]
}

function isHttpUrl(value: string) {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}
