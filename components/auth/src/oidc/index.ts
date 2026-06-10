/**
 * OIDC-слой: вход через authentik (password + timestamp-signature),
 * magic-link, recovery и работа с токенами (oidc-client-ts).
 */
import { AuthV2Error, AuthV2ErrorCode, notImplemented } from '../errors'

export interface LoginParams {
  /** Issuer кооператива, например `https://coop.example/application/o/coopid/` */
  issuer: string
  email: string
  password: string
}

export interface LoginResult {
  accessToken: string
  idToken: string
  /** compact JWS ES256K, выпускается controller'ом */
  participantCertificate: string
}

/** Двухэтапный вход: password (authentik) → timestamp-signature (controller). Story 1.7. */
export async function login(_params: LoginParams): Promise<LoginResult> {
  notImplemented('login')
}

/** Вход по magic-link (восстановление доступа). Story 3.1. */
export async function loginWithMagicLink(_link: string): Promise<LoginResult> {
  notImplemented('loginWithMagicLink')
}

/** Восстановление доступа (magic-link / offline-код, по стратегии кооператива). Эпик 3. */
export async function recover(_email: string): Promise<void> {
  notImplemented('recover')
}

/** Текущий access_token (с автообновлением через refresh). Story 1.7. */
export async function getAccessToken(): Promise<string> {
  notImplemented('getAccessToken')
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

/** RP-initiated logout: revoke refresh_token, очистка сессии и keystore. Story 1.10. */
export async function logout(): Promise<void> {
  notImplemented('logout')
}
