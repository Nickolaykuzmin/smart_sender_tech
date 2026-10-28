import { request } from './client'
import type { User, Webhook, WebhookList } from './types'

export const PAGE_SIZE = 10

export const getMe = () => request<User>('GET', '/v1/me')

export function getWebhooks(page: number, search: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), search })
  return request<WebhookList>('GET', `/v1/webhooks?${params}`)
}

export const getWebhook = (id: number) => request<Webhook>('GET', `/v1/webhooks/${id}`)

export const updateWebhook = (id: number, data: { name: string; url: string }) =>
  request<Webhook>('PUT', `/v1/webhooks/${id}`, data)
