/**
 * Минимальный helper для integration-тестов: логин chairman'а
 * (ant/ivanov@example.com) и выполнение произвольных GraphQL запросов
 * против controller — в том числе тех, для которых в SDK ещё нет
 * типизированной query (ProcessRegistry на момент Epic 4).
 *
 * Для typed-запросов (ledger2) используйте SDK Client напрямую.
 */

import ecc from 'eosjs-ecc'

// eslint-disable-next-line node/prefer-global/process
const API_URL = process.env.API_URL || 'http://127.0.0.1:2998/v1/graphql'
// eslint-disable-next-line node/prefer-global/process
const CHAIN_URL = process.env.CHAIN_URL || 'http://127.0.0.1:8888'
// eslint-disable-next-line node/prefer-global/process
const SERVER_SECRET = process.env.SERVER_SECRET || 'SECRET'
// eslint-disable-next-line node/prefer-global/process
const TEST_EMAIL = process.env.TEST_EMAIL || 'ivanov@example.com'
// eslint-disable-next-line node/prefer-global/process
const TEST_WIF = process.env.TEST_WIF || '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'

export interface LoginResult {
  token: string
  username: string
}

export async function loginAsChairman(): Promise<LoginResult> {
  const info = await (await fetch(`${CHAIN_URL}/v1/chain/get_info`)).json()
  const now = info.head_block_time

  // SDK Client.login хэширует utf8-строку timestamp'а в sha256 и подписывает
  // digest приватным ключом. eosjs-ecc делает это через signHash(digest, wif).
  const digest = ecc.sha256(Buffer.from(now, 'utf8'), 'hex')
  const signature = ecc.signHash(digest, TEST_WIF)

  const mutation = `mutation($d:LoginInput!){ login(data:$d){ tokens{ access{ token } } account{ username } } }`
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'server-secret': SERVER_SECRET },
    body: JSON.stringify({
      query: mutation,
      variables: { d: { email: TEST_EMAIL, now, signature } },
    }),
  })
  const payload: any = await res.json()
  if (payload.errors) {
    throw new Error(`login failed: ${JSON.stringify(payload.errors)}`)
  }
  const token = payload.data.login.tokens.access.token as string
  const username = payload.data.login.account.username as string
  return { token, username }
}

export async function gql<T = any>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'server-secret': SERVER_SECRET,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  })
  const text = await res.text()
  let payload: any
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error(`gql non-JSON response (status=${res.status}): ${text.slice(0, 200)}`)
  }
  if (payload.errors) {
    const firstMsg = payload.errors[0]?.message ?? 'unknown'
    throw new Error(`gql failed: ${firstMsg}`)
  }
  return payload.data as T
}

/**
 * Polling-ожидание: parser обычно отстаёт от head_block на 1-3 секунды,
 * иногда до десятка. Дёргаем предикат каждые 500 мс до timeout.
 */
export async function waitUntil<T>(
  predicate: () => Promise<T | null>,
  opts: { timeoutMs?: number; intervalMs?: number; label?: string } = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 30_000
  const intervalMs = opts.intervalMs ?? 500
  const label = opts.label ?? 'predicate'
  const deadline = Date.now() + timeoutMs
  let attempts = 0
  while (Date.now() < deadline) {
    attempts += 1
    const last = await predicate()
    if (last !== null) return last
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`waitUntil(${label}) timed out after ${timeoutMs}ms (${attempts} attempts)`)
}
