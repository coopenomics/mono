/**
 * Общее для живых тестов стенда, которые проверяют путь через провайдера:
 * запросы к провайдеру тем же каналом, что и хаб, и ожидание тактов хаба и
 * провайдера. Используют бак AXON (billing-tank) и полный путь приложения
 * каталога на связке двух кооперативов (catalog-apps-two-coop).
 */
import process from 'node:process'
import { SERVER_SECRET } from '../marketplace/chainHelpers'

export const PROVIDER_URL = process.env.PROVIDER_URL || 'http://127.0.0.1:3005'
const PROVIDER_BEARER_TOKEN = process.env.PROVIDER_BEARER_TOKEN || ''

/** Каталог витрины провайдер отдаёт по Bearer-токену Восхода, остальное — по server-secret. */
export async function provider<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const auth: Record<string, string> = path.startsWith('/v1/')
    ? { Authorization: `Bearer ${PROVIDER_BEARER_TOKEN}` }
    : { 'server-secret': SERVER_SECRET }
  const res = await fetch(`${PROVIDER_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...auth },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok)
    throw new Error(`provider ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : (undefined as T)
}

export const subscriptionsOf = (coop: string) => provider<any[]>('GET', `/subscriptions/by-username/${coop}`)
export const paymentsOf = (id: number) => provider<any[]>('GET', `/subscriptions/${id}/payments`)

export async function waitFor<T>(label: string, timeoutMs: number, probe: () => Promise<T | null | undefined | false>): Promise<T> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = await probe().catch(() => null)
    if (value)
      return value as T
    if (Date.now() > deadline)
      throw new Error(`не дождались: ${label} за ${Math.round(timeoutMs / 1000)} с`)
    // timing: backoff — опрос стенда, пока такт хаба или провайдера не сделает своё
    await new Promise(r => setTimeout(r, 5_000))
  }
}
