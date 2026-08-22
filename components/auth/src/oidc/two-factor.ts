/**
 * Подтверждение второго фактора входа (2FA-логин), клиентская сторона.
 *
 * `login()` бросил `SecondFactorRequired` с challenge в `details` — значит пароль
 * и ключ уже доказаны, кошелёк разблокирован, но платформенные токены сервер
 * удержал. Здесь коды факторов (TOTP / письмо) доводят вход до конца: последний
 * подтверждённый фактор возвращает токены, они кладутся в сессию — дальше
 * приложение продолжает свой обычный пост-логин.
 */
import type { HandshakeResult, LoginFactorKind } from './handshake'
import { AuthV2Error, AuthV2ErrorCode } from '../errors'
import { coopIdApiUrl } from './client'
import { setSession } from './tokens'

export type { LoginFactorKind, SecondFactorChallenge } from './handshake'

export interface ConfirmLoginFactorParams {
  /** challenge_token из `SecondFactorRequired.details`. */
  challengeToken: string
  /** Введённый пайщиком код текущего фактора (6 цифр). */
  code: string
}

/** Промежуточный исход: фактор пройден, сервер ждёт следующий. */
export interface LoginFactorProgress {
  done: false
  passedFactor: LoginFactorKind
  nextFactor: LoginFactorKind
}

/** Финальный исход: все факторы пройдены, сессия установлена. */
export interface LoginFactorCompleted extends HandshakeResult {
  done: true
}

export type ConfirmLoginFactorResult = LoginFactorProgress | LoginFactorCompleted

interface ConfirmResponseProgress {
  passed_factor: LoginFactorKind
  next_factor: LoginFactorKind
}

interface ConfirmResponseTokens {
  access_token: string
  refresh_token: string
  participant_certificate?: string
  degraded?: boolean
  degraded_reason?: string
}

/** Разобрать OAuth2-ошибку контроллера ({ error, error_description }) в AuthV2Error. */
async function authErrorFromResponse(res: Response, fallback: AuthV2ErrorCode, fallbackMsg: string): Promise<AuthV2Error> {
  const body = (await res.json().catch(() => null)) as { error?: string, error_description?: string } | null
  return new AuthV2Error((body?.error as AuthV2ErrorCode) ?? fallback, body?.error_description ?? fallbackMsg)
}

/**
 * Подтвердить текущий фактор challenge. На финальном факторе сервер возвращает
 * токены — они сохраняются в сессию (как в `performTimestampHandshake`), и
 * вызывающий продолжает обычный пост-логин.
 */
export async function confirmLoginFactor(params: ConfirmLoginFactorParams): Promise<ConfirmLoginFactorResult> {
  const base = coopIdApiUrl().replace(/\/$/, '')
  let res: Response
  try {
    res = await fetch(`${base}/coop/verify/2fa/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ challenge_token: params.challengeToken, code: params.code }),
    })
  }
  catch (e) {
    throw new AuthV2Error(AuthV2ErrorCode.NetworkError, `Сеть недоступна при подтверждении входа: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (!res.ok)
    throw await authErrorFromResponse(res, AuthV2ErrorCode.InvalidTwoFactorCode, `Подтверждение входа отклонено (HTTP ${res.status})`)

  const body = (await res.json()) as ConfirmResponseProgress | ConfirmResponseTokens
  if ('access_token' in body) {
    setSession(base, { accessToken: body.access_token, refreshToken: body.refresh_token })
    return {
      done: true,
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      participantCertificate: body.participant_certificate,
      degraded: Boolean(body.degraded),
      degradedReason: body.degraded_reason,
    }
  }
  return { done: false, passedFactor: body.passed_factor, nextFactor: body.next_factor }
}

/**
 * Повторно отправить email-код текущего challenge (сервер троттлит: не чаще
 * раза в минуту и не больше 5 писем на challenge).
 */
export async function resendLoginEmailCode(challengeToken: string): Promise<void> {
  const base = coopIdApiUrl().replace(/\/$/, '')
  let res: Response
  try {
    res = await fetch(`${base}/coop/verify/2fa/resend`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ challenge_token: challengeToken }),
    })
  }
  catch (e) {
    throw new AuthV2Error(AuthV2ErrorCode.NetworkError, `Сеть недоступна при повторной отправке кода: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (!res.ok && res.status !== 202)
    throw await authErrorFromResponse(res, AuthV2ErrorCode.NetworkError, `Повторная отправка кода отклонена (HTTP ${res.status})`)
}
