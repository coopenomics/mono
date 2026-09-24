/**
 * Клиент GraphQL внешнего слоя. Ходит тем же путём, что рабочий стол: только
 * Bearer-токен, без заголовка `server-secret`. Этот заголовок — межсервисный
 * обход, и с ним часть проверок прав не выполняется вовсе (например,
 * MarketplaceMembershipGuard выходит рано), так что тест с ним проверял бы
 * не то, что видит пайщик.
 */
import { API_URL } from './env'

export interface GqlError {
  message: string
  code: string | null
  path: readonly (string | number)[] | null
}

export interface GqlResponse<T> {
  status: number
  data: T | null
  errors: GqlError[]
}

/** Ответ целиком — для проверок, где ошибка и есть ожидаемый исход. */
export async function gqlRaw<T = any>(token: string | null, query: string, variables?: unknown): Promise<GqlResponse<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token)
    headers.Authorization = `Bearer ${token}`
  const res = await fetch(API_URL, { method: 'POST', headers, body: JSON.stringify({ query, variables }) })
  const text = await res.text()
  let payload: any
  try {
    payload = JSON.parse(text)
  }
  catch {
    return { status: res.status, data: null, errors: [{ message: `не-JSON ответ: ${text.slice(0, 200)}`, code: 'NON_JSON', path: null }] }
  }
  const errors: GqlError[] = (payload.errors ?? []).map((e: any) => ({
    message: String(e?.message ?? ''),
    code: e?.extensions?.code ?? null,
    path: e?.path ?? null,
  }))
  return { status: res.status, data: payload.data ?? null, errors }
}

export class ApiError extends Error {
  constructor(readonly errors: GqlError[], readonly status: number) {
    super(`gql: ${errors.map(e => e.code ? `[${e.code}] ${e.message}` : e.message).join('; ')}`)
  }
}

/** Ответ без ошибок — иначе ApiError с кодами и текстами сервера. */
export async function gql<T = any>(token: string | null, query: string, variables?: unknown): Promise<T> {
  const r = await gqlRaw<T>(token, query, variables)
  if (r.errors.length)
    throw new ApiError(r.errors, r.status)
  return r.data as T
}

/** Ошибка вызова, если он упал; null — если прошёл. */
export async function gqlError(token: string | null, query: string, variables?: unknown): Promise<GqlError | null> {
  const r = await gqlRaw(token, query, variables)
  return r.errors[0] ?? null
}
