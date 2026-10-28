import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { createHandlers, TEST_EMAIL, TEST_PASSWORD } from '../mocks/handlers'
import { authApi } from './client'
import { getMe, getWebhooks } from './endpoints'

const server = setupServer(...createHandlers())

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => vi.restoreAllMocks())
afterAll(() => server.close())

test('two parallel 401s share one rotate and both retries succeed', async () => {
  const { device_session_token } = await authApi.login(TEST_EMAIL, TEST_PASSWORD)
  await authApi.issue(device_session_token)

  const calls: string[] = []
  server.events.on('request:start', ({ request }) => calls.push(new URL(request.url).pathname))

  // Session expires.
  const now = Date.now()
  vi.spyOn(Date, 'now').mockReturnValue(now + 31_000)

  const [me, list] = await Promise.all([getMe(), getWebhooks(1, '')])

  expect(me.email).toBe(TEST_EMAIL)
  expect(list.data).toHaveLength(10)
  expect(calls.filter((p) => p === '/auth/token/rotate')).toHaveLength(1)
  expect(calls.filter((p) => p === '/v1/me')).toHaveLength(2)
  expect(calls.filter((p) => p === '/v1/webhooks')).toHaveLength(2)
})
