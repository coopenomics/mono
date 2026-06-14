/**
 * OIDC-слой: вход через authentik (password + timestamp-signature),
 * magic-link, recovery и работа с токенами (oidc-client-ts).
 */
import { AuthV2Error, AuthV2ErrorCode, notImplemented } from '../errors'
import { clearPinProtected, lockWallet, type StorageAdapter } from '../wallet'
import { authenticateWithAuthentik, coopIdApiUrl } from './client'
import { performTimestampHandshake } from './handshake'
import { clearSession, getAccessToken as getStoredAccessToken } from './tokens'

export { authenticateWithAuthentik, configureCoopId, configureOidc } from './client'
export { authenticateWithFlowExecutor, DEFAULT_AUTHENTICATION_FLOW } from './flow-executor'
export type { FlowExecutorParams } from './flow-executor'
export type { HandshakeResult } from './handshake'
export { performTimestampHandshake } from './handshake'
export type { SessionTokens } from './tokens'
export { currentTokens } from './tokens'

export interface LoginParams {
  /** Issuer кооператива, например `https://coop.example/application/o/coopid/` */
  issuer: string
  email: string
  /**
   * Пароль пайщика (Story 11.2). Уходит во встроенную форму → flow-executor
   * authentik (фактор 1), а не в наш backend — запрещённый FR29 `grant_type=password`
   * не используется. Тем же паролем клиент шифрует password-vault (Story 11.3).
   */
  password: string
  /** Slug flow аутентификации authentik (по умолчанию `default-authentication-flow`). */
  flowSlug?: string
}

export interface LoginResult {
  accessToken: string
  idToken: string
  /** compact JWS ES256K, выпускается controller'ом */
  participantCertificate: string
}

/**
 * Двухэтапный вход (Story 1.7, обновлён Story 11.2): (1) password через authentik —
 * встроенная форма гонит email+password в flow-executor (сессия), затем
 * `authorization_code`+PKCE молча (`signinSilent`); (2) timestamp-signature handshake
 * против controller'а (bind → подпись ключом из keystore → verify). Перед вызовом
 * кошелёк должен быть разблокирован (`unlockWallet`), иначе handshake бросит WalletLocked.
 *
 * База controller'а берётся из `configureCoopId({ apiUrl })`, OIDC-клиент — из
 * `configureOidc({ clientId, redirectUri })` (вызываются приложением на старте).
 */
export async function login(params: LoginParams): Promise<LoginResult> {
  const apiUrl = coopIdApiUrl()
  // 1. password-этап: устанавливает сессию authentik (cookie) + отдаёт id_token.
  const user = await authenticateWithAuthentik({ issuer: params.issuer, email: params.email, password: params.password, flowSlug: params.flowSlug })
  // 2. timestamp-signature handshake: платформенные токены + удостоверение.
  const handshake = await performTimestampHandshake(apiUrl)
  return {
    accessToken: handshake.accessToken,
    idToken: user.id_token ?? '',
    participantCertificate: handshake.participantCertificate ?? '',
  }
}

/** Вход по magic-link (восстановление доступа). Story 3.1 — recovery-confirm + ротация ключа. */
export async function loginWithMagicLink(_link: string): Promise<LoginResult> {
  // Полный confirm-флоу (ротация ключа registrator::changekey + повторный handshake)
  // относится к recovery-UX Эпика 3 и финализируется во фронт-фазе.
  notImplemented('loginWithMagicLink')
}

/**
 * Запросить восстановление доступа (magic-link на email; по стратегии кооператива
 * — также offline-код). Эпик 3, `POST /coop/recovery/request`. Анти-enumeration:
 * сервер всегда отвечает 202 вне зависимости от существования аккаунта.
 */
export async function recover(email: string): Promise<void> {
  const base = coopIdApiUrl()
  let res: Response
  try {
    res = await fetch(`${base}/coop/recovery/request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    })
  }
  catch (e) {
    throw new AuthV2Error(AuthV2ErrorCode.NetworkError, `Сеть недоступна при запросе восстановления: ${e instanceof Error ? e.message : String(e)}`)
  }
  // 202 — нормальный путь; иные коды (кроме rate-limit) — ошибка конфигурации/сети.
  if (res.status === 429)
    throw new AuthV2Error(AuthV2ErrorCode.TooManyRecoveryAttempts, 'Слишком много попыток восстановления, попробуйте позже')
  if (!res.ok && res.status !== 202)
    throw new AuthV2Error(AuthV2ErrorCode.NetworkError, `Запрос восстановления отклонён (HTTP ${res.status})`)
}

/** Текущий access_token (с автообновлением через refresh). Story 1.7. */
export async function getAccessToken(): Promise<string> {
  return getStoredAccessToken()
}

/**
 * Актуальное participant_certificate текущей сессии — compact JWS из
 * `GET /coop/certificate` (Story 1.8). `accessToken` — платформенный токен входа
 * (Bearer). Декодирование claims — `decodeParticipantCertificate` (certificate/).
 */
export async function getParticipantCertificate(apiUrl: string, accessToken: string): Promise<string> {
  let res: Response
  try {
    res = await fetch(`${apiUrl.replace(/\/$/, '')}/coop/certificate`, {
      headers: { authorization: `Bearer ${accessToken}` },
    })
  }
  catch (e) {
    throw new AuthV2Error(AuthV2ErrorCode.NetworkError, `Сеть недоступна при запросе удостоверения: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (!res.ok)
    throw new AuthV2Error(AuthV2ErrorCode.NetworkError, `Не удалось получить удостоверение (HTTP ${res.status})`)
  const body = (await res.json()) as { participant_certificate: string }
  return body.participant_certificate
}

export interface LogoutParams {
  /** Базовый URL controller'а кооператива (например `https://coop.example`). */
  apiUrl: string
  /** refresh_token текущей сессии — отзывается на сервере. */
  refreshToken: string
  /** access_token (опционально) — тоже отзывается. */
  accessToken?: string
  /** Хранилище PIN-protected ключа — стирается, если вход по PIN был включён. */
  pinStorage?: StorageAdapter
}

/**
 * RP-initiated logout (Story 1.10): отзыв токенов на сервере + затирание локального
 * keystore. Серверный вызов — best-effort; локальное затирание ключа и сессии
 * выполняется ВСЕГДА (в `finally`), даже если сервер недоступен — безопасность важнее
 * «чистого» logout: расшифрованный ключ не должен остаться в памяти браузера при
 * сетевом сбое. Редирект на login — на стороне вызывающего. Стандартный OIDC
 * end-session — Story 5.1.
 */
export async function logout(params: LogoutParams): Promise<void> {
  try {
    await fetch(`${params.apiUrl.replace(/\/$/, '')}/coop/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: params.refreshToken, access_token: params.accessToken }),
    })
  }
  catch {
    // best-effort: недоступность сервера не должна блокировать локальное затирание ключа
  }
  finally {
    lockWallet()
    clearSession()
    if (params.pinStorage)
      await clearPinProtected(params.pinStorage)
  }
}
