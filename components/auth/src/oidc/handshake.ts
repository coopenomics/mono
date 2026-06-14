/**
 * Второй этап входа CoopID — timestamp-signature handshake (Story 1.7), браузер-
 * агностичная часть фасада логина. Предполагает уже установленную сессию authentik
 * (cookie доезжает на bind через `credentials: 'include'`); первый этап (password,
 * Authorization Code + PKCE через oidc-client-ts, FR29) делает `client.ts`.
 *
 * Поток: `/coop/session/bind` → `signTimestamp` (ключ берётся из keystore, наружу
 * не выходит) → `/coop/verify/timestamp`. Полученные токены кладутся в сессию
 * (`tokens.ts`) и возвращаются вызывающему.
 */
import { AuthV2Error, AuthV2ErrorCode } from '../errors'
import { signTimestamp } from '../signing'
import { setSession } from './tokens'

export interface HandshakeResult {
  accessToken: string
  refreshToken: string
  /** compact JWS ES256K, выпускается controller'ом (Story 1.8); может отсутствовать. */
  participantCertificate?: string
  /** true → вход выдан в degraded-режиме (узел недоступен / ключ не финализирован, Story 9.6). */
  degraded: boolean
  degradedReason?: string
}

interface BindResponse {
  binding_token: string
  expires_in: number
}

interface VerifyResponse {
  access_token: string
  refresh_token: string
  participant_certificate?: string
  degraded?: boolean
  degraded_reason?: string
}

/** Извлечь AuthV2Error из тела ответа контроллера (OAuth2-формат { error, error_description }). */
async function authErrorFromResponse(res: Response, fallback: AuthV2ErrorCode, fallbackMsg: string): Promise<AuthV2Error> {
  const body = (await res.json().catch(() => null)) as { error?: string, error_description?: string } | null
  const code = (body?.error as AuthV2ErrorCode) ?? fallback
  return new AuthV2Error(code, body?.error_description ?? fallbackMsg)
}

/**
 * Выполняет handshake второго этапа и сохраняет сессию. `apiUrl` — база controller'а
 * кооператива (например `https://coop.example`).
 */
export async function performTimestampHandshake(apiUrl: string): Promise<HandshakeResult> {
  const base = apiUrl.replace(/\/$/, '')

  // 1. bind: session_binding_token из тела (Эпик 7, D2). credentials:'include' —
  //    чтобы сессионная cookie authentik доехала до controller'а для резолва username.
  let bindRes: Response
  try {
    bindRes = await fetch(`${base}/coop/session/bind`, { method: 'POST', credentials: 'include' })
  }
  catch (e) {
    throw new AuthV2Error(AuthV2ErrorCode.NetworkError, `Сеть недоступна на этапе bind: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (bindRes.status === 401 || bindRes.status === 403)
    throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, 'Сессия authentik не подтверждена: пройдите первый этап входа (password)')
  if (!bindRes.ok)
    throw await authErrorFromResponse(bindRes, AuthV2ErrorCode.NetworkError, `bind вернул HTTP ${bindRes.status}`)
  const bind = (await bindRes.json()) as BindResponse
  if (!bind?.binding_token)
    throw new AuthV2Error(AuthV2ErrorCode.SessionBindingExpired, 'bind не вернул session_binding_token')

  // 2. подпись канонической метки (jti/sub — из binding_token; ключ — из keystore,
  //    бросит WalletLocked, если кошелёк заперт).
  const sig = await signTimestamp({ sessionBindingToken: bind.binding_token })

  // 3. verify: доказательство владения ключом → платформенные токены + сертификат.
  let verifyRes: Response
  try {
    verifyRes = await fetch(`${base}/coop/verify/timestamp`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ signature: sig.signature, timestamp: sig.ts, binding_token: bind.binding_token }),
    })
  }
  catch (e) {
    throw new AuthV2Error(AuthV2ErrorCode.NetworkError, `Сеть недоступна на этапе verify: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (!verifyRes.ok)
    throw await authErrorFromResponse(verifyRes, AuthV2ErrorCode.ChainVerificationFailed, `verify вернул HTTP ${verifyRes.status}`)

  const v = (await verifyRes.json()) as VerifyResponse
  setSession(base, { accessToken: v.access_token, refreshToken: v.refresh_token })

  return {
    accessToken: v.access_token,
    refreshToken: v.refresh_token,
    participantCertificate: v.participant_certificate,
    degraded: Boolean(v.degraded),
    degradedReason: v.degraded_reason,
  }
}
