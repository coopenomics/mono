/**
 * OIDC-слой: вход через authentik (password + timestamp-signature),
 * magic-link, recovery и работа с токенами (oidc-client-ts).
 */
import { notImplemented } from '../errors'

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

/** Актуальное participant_certificate текущей сессии. Story 1.8. */
export async function getParticipantCertificate(): Promise<string> {
  notImplemented('getParticipantCertificate')
}

/** RP-initiated logout: revoke refresh_token, очистка сессии и keystore. Story 1.10. */
export async function logout(): Promise<void> {
  notImplemented('logout')
}
