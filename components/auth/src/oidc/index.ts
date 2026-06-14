import type { VaultSubject } from '../vault/types'
import type { StorageAdapter } from '../wallet'
/**
 * OIDC-слой: вход через authentik (password + timestamp-signature),
 * magic-link, recovery и работа с токенами (oidc-client-ts).
 */
import { AuthV2Error, AuthV2ErrorCode } from '../errors'
import { encryptPrivateKey } from '../vault/encrypt'
import { lockWallet, saveLocalVault, unlockWallet } from '../wallet'
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

/** Разобрать OAuth2-ошибку контроллера ({ error, error_description }) в AuthV2Error. */
async function authErrorFromResponse(res: Response, fallback: AuthV2ErrorCode, fallbackMsg: string): Promise<AuthV2Error> {
  const body = (await res.json().catch(() => null)) as { error?: string, error_description?: string } | null
  return new AuthV2Error((body?.error as AuthV2ErrorCode) ?? fallback, body?.error_description ?? fallbackMsg)
}

export interface LoginWithMagicLinkParams {
  /** Issuer кооператива — для повторного входа через authentik уже новым паролём. */
  issuer: string
  /** Email пайщика — фактор-1 повторной аутентификации в authentik после смены ключа. */
  email: string
  /**
   * COOPOS-аккаунт пайщика (subject_id vault'а). Нужен дважды: как AAD при шифровании
   * нового блоба и как субъект при последующем unlock — оба обязаны совпадать, иначе
   * расшифровка провалится. Magic-link несёт только непрозрачный `token`; как получить
   * по нему аккаунт — открытый контракт фронт-фазы 12.3 (кандидат — серверный
   * whoami-by-token), здесь аккаунт подаёт вызывающий.
   */
  account: string
  /** Magic-link токен из ссылки восстановления (или `recovery_token` offline-канала, Story 3.4). */
  token: string
  /** TOTP-код из приложения-аутентификатора — второй фактор подтверждения (Story 3.2/3.6). */
  totp: string
  /** Новый пароль: им шифруется новый vault и он же ставится в authentik (Story 12.1). */
  newPassword: string
  /** Slug flow аутентификации authentik (по умолчанию `default-authentication-flow`). */
  flowSlug?: string
  /** Если задано — сохранить локальную копию нового зашифрованного vault'а на устройстве. */
  storage?: StorageAdapter
}

/**
 * Вход по magic-link (восстановление доступа) — полный confirm-флоу + повторный вход
 * (Эпик 12, Story 12.2). Старый ключ пайщиком утрачен (на то и восстановление),
 * поэтому клиент генерит НОВУЮ пару: приватный шифруется новым паролём в vault и
 * наружу/на сервер не уходит, on-chain едет только публичный.
 *
 * Шаги: (1) сгенерировать пару; (2) зашифровать новый ключ новым паролём (AAD=субъект);
 * (3) `POST /coop/recovery/confirm` {token, TOTP, public_key, vault, password} — сервер
 * (12.1) ставит пароль в authentik, сохраняет vault, ротирует active-ключ
 * (`registrator::changekey`) и отзывает старые сессии; (4) повторный вход новым контуром:
 * authentik-сессия новым паролём → `unlockWallet` (расшифровать только что записанный
 * блоб → keystore) → timestamp-handshake. Ключ к этому моменту уже ротирован on-chain,
 * поэтому verify увидит новый pubkey (при лаге узла handshake вернёт degraded, Story 9.6).
 */
export async function loginWithMagicLink(params: LoginWithMagicLinkParams): Promise<LoginResult> {
  const apiUrl = coopIdApiUrl()

  // 1. Новая пара ключей (старый утрачен). WIF в формате `5J…`/`5K…` — как везде в системе.
  const { PrivateKey } = await import('@wharfkit/antelope')
  const newKey = PrivateKey.generate('K1')
  const newPrivateKey = newKey.toWif()
  const newPublicKey = newKey.toPublic().toString()

  // 2. Зашифровать новый ключ новым паролём. subject_id=account обязателен: тем же
  //    субъектом пойдёт unlock на шаге 4, иначе AAD не сойдётся и расшифровка упадёт.
  const subject: VaultSubject = { subject_type: 'participant', subject_id: params.account }
  const vaultBlob = await encryptPrivateKey(newPrivateKey, params.newPassword, subject)

  // 3. confirm: токен magic-link + TOTP + новый материал. Тело — контракт RecoveryConfirmBody.
  let res: Response
  try {
    res = await fetch(`${apiUrl}/coop/recovery/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: params.token, code: params.totp, public_key: newPublicKey, vault: vaultBlob, password: params.newPassword }),
    })
  }
  catch (e) {
    throw new AuthV2Error(AuthV2ErrorCode.NetworkError, `Сеть недоступна при подтверждении восстановления: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (res.status === 429)
    throw new AuthV2Error(AuthV2ErrorCode.TooManyRecoveryAttempts, 'Слишком много попыток подтверждения, попробуйте позже')
  if (!res.ok)
    throw await authErrorFromResponse(res, AuthV2ErrorCode.InvalidRecoveryToken, `Подтверждение восстановления отклонено (HTTP ${res.status})`)

  // 4. Локальная копия нового блоба (best-effort на устройстве восстановления).
  if (params.storage)
    await saveLocalVault(params.storage, params.account, vaultBlob)

  // 5. Повторный вход новым контуром. unlockWallet забирает только что сохранённый
  //    серверный блоб и расшифровывает новым паролём — заодно round-trip-проверка vault'а.
  const user = await authenticateWithAuthentik({ issuer: params.issuer, email: params.email, password: params.newPassword, flowSlug: params.flowSlug })
  await unlockWallet({ apiUrl, account: params.account, password: params.newPassword })
  const handshake = await performTimestampHandshake(apiUrl)
  return {
    accessToken: handshake.accessToken,
    idToken: user.id_token ?? '',
    participantCertificate: handshake.participantCertificate ?? '',
  }
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
  }
}
