/**
 * Lifecycle платформенных токенов сессии CoopID (Эпик 7). Источник истины токена —
 * этот модуль `@coopenomics/auth`; `@coopenomics/sdk` копирует access в свои
 * GraphQL-заголовки (D1: bearer не покидает слой SDK, приложение его не трогает).
 *
 * Хранение — in-memory (как keystore ключа): по умолчанию живёт только в RAM
 * вкладки. Персистентность между перезагрузками подключается приложением через
 * `StorageAdapter` (frontend — IndexedDB), чтобы крипто-/токен-логика не зависела
 * от среды и тестировалась без браузера.
 */
import { decodeJwt } from 'jose'
import { AuthV2Error, AuthV2ErrorCode } from '../errors'

export interface SessionTokens {
  accessToken: string
  refreshToken: string
}

/** Запас до фактического exp, при котором access считаем «пора обновлять». */
const REFRESH_SKEW_SEC = 30

let tokens: SessionTokens | null = null
let apiBase: string | null = null

/** Кладёт токены текущей сессии (вызывается из handshake/login). `apiUrl` — база controller'а для refresh. */
export function setSession(apiUrl: string, next: SessionTokens): void {
  apiBase = apiUrl.replace(/\/$/, '')
  tokens = next
}

/** Затирает токены сессии (logout). Идемпотентно. */
export function clearSession(): void {
  tokens = null
  apiBase = null
}

/** Снимок текущих токенов (или null, если сессии нет). */
export function currentTokens(): SessionTokens | null {
  return tokens ? { ...tokens } : null
}

/** Истёк ли (или вот-вот истечёт) access-токен. Невалидный/без exp → считаем истёкшим. */
function accessExpired(token: string): boolean {
  try {
    const { exp } = decodeJwt(token)
    if (typeof exp !== 'number')
      return true
    return exp - REFRESH_SKEW_SEC <= Math.floor(Date.now() / 1000)
  }
  catch {
    return true
  }
}

/**
 * Обновляет пару токенов через REST `/coop/refresh` (то же зеркало платформенной
 * токен-машинерии, что и legacy GraphQL-refresh). 401 → сессия истекла/отозвана.
 */
export async function refreshSession(base: string, refreshToken: string): Promise<SessionTokens> {
  let res: Response
  try {
    res = await fetch(`${base}/coop/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
  }
  catch (e) {
    throw new AuthV2Error(AuthV2ErrorCode.NetworkError, `Сеть недоступна при обновлении токена: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (res.status === 401 || res.status === 403)
    throw new AuthV2Error(AuthV2ErrorCode.SessionBindingExpired, 'Сессия истекла: требуется повторный вход')
  if (!res.ok)
    throw new AuthV2Error(AuthV2ErrorCode.NetworkError, `Не удалось обновить токен (HTTP ${res.status})`)

  const body = (await res.json()) as { access_token: string, refresh_token: string }
  return { accessToken: body.access_token, refreshToken: body.refresh_token }
}

/**
 * Текущий access_token с авто-обновлением через refresh (Story 1.7). Бросает, если
 * активной сессии нет (нужно войти). Обновлённую пару кладёт обратно в сессию.
 */
export async function getAccessToken(): Promise<string> {
  if (!tokens || !apiBase)
    throw new AuthV2Error(AuthV2ErrorCode.WalletLocked, 'Нет активной сессии: сначала выполните вход')
  if (!accessExpired(tokens.accessToken))
    return tokens.accessToken

  const refreshed = await refreshSession(apiBase, tokens.refreshToken)
  tokens = refreshed
  return tokens.accessToken
}
