// Headless-вход CoopID для CLI (Node, без браузера): flow-executor authentik с
// собственным cookie-jar → bind → расшифровка vault паролем → timestamp-handshake
// [→ интерактивные коды 2FA]. Браузерный фасад `@coopenomics/auth.login()` здесь
// неприменим: он живёт на oidc-client-ts (iframe) и document.cookie. Из пакета
// берём только Node-совместимые примитивы (unlockWallet, signTimestamp).

import { AuthV2Error, AuthV2ErrorCode, signTimestamp, unlockWallet } from '@coopenomics/auth'

export const DEFAULT_AUTHENTICATION_FLOW = 'default-authentication-flow'

/** Предохранитель от зацикливания на неожиданной последовательности стадий flow. */
const MAX_FLOW_STEPS = 8
/** Максимум интерактивных попыток кода на фактор (сервер сжигает challenge раньше). */
const MAX_CODE_PROMPTS = 5

export interface CoopIdLoginParams {
  /** База REST controller'а кооператива (профиль blago: `api_url`, напр. `https://host/backend`). */
  readonly apiUrl: string
  /** Issuer authentik; по умолчанию `origin(apiUrl)` — same-origin топология Эпика 5. */
  readonly issuer?: string
  readonly email: string
  readonly password: string
  /** Интерактивный запрос кода 2FA (totp — приложение, email — письмо). */
  readonly promptCode: (factor: 'totp' | 'email') => Promise<string>
}

export interface CoopIdLoginResult {
  readonly accessToken: string
  readonly refreshToken: string
  readonly username: string
}

/** Cookie-jar на один вход: в Node глобальный fetch куки не хранит. */
class CookieJar {
  private readonly cookies = new Map<string, string>()

  absorb(res: Response): void {
    for (const line of res.headers.getSetCookie()) {
      const pair = line.split(';', 1)[0] ?? ''
      const eq = pair.indexOf('=')
      if (eq > 0) {
        this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
      }
    }
  }

  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  }

  get(name: string): string | null {
    const v = this.cookies.get(name)
    return v === undefined ? null : decodeURIComponent(v)
  }
}

/** Снимок challenge'а flow-executor (только нужные поля). */
interface FlowChallenge {
  type?: string
  component?: string
  response_errors?: Record<string, Array<{ string?: string, code?: string }>>
}

function isFlowSuccess(c: FlowChallenge): boolean {
  return c.type === 'redirect' || c.component === 'xak-flow-redirect' || c.component === 'ak-stage-user-login'
}

function firstResponseError(c: FlowChallenge): string | null {
  const groups = c.response_errors
  if (!groups) {
    return null
  }
  for (const key of Object.keys(groups)) {
    const msg = groups[key]?.find(e => e.string)?.string
    if (msg) {
      return msg
    }
  }
  return Object.keys(groups).length > 0 ? '' : null
}

/**
 * Фактор-1 (email+password) через flow-executor authentik — Node-порт браузерного
 * `authenticateWithFlowExecutor`: та же последовательность стадий, но куки и CSRF
 * ведём вручную. Успех — установленная сессия authentik в jar.
 */
async function authenticateFlow(jar: CookieJar, issuer: string, email: string, password: string): Promise<void> {
  const base = new URL(issuer).origin
  const url = `${base}/api/v3/flows/executor/${encodeURIComponent(DEFAULT_AUTHENTICATION_FLOW)}/?query=`

  async function step(init?: { body: Record<string, unknown> }): Promise<FlowChallenge> {
    const csrf = jar.get('authentik_csrf')
    const res = await fetch(url, {
      method: init ? 'POST' : 'GET',
      headers: {
        accept: 'application/json',
        cookie: jar.header(),
        ...(init ? { 'content-type': 'application/json' } : {}),
        ...(csrf ? { 'X-authentik-CSRF': csrf } : {}),
      },
      ...(init ? { body: JSON.stringify(init.body) } : {}),
    })
    jar.absorb(res)
    // 400 — authentik перерисовывает стадию с response_errors (неверный пароль).
    if (!res.ok && res.status !== 400) {
      throw new AuthV2Error(AuthV2ErrorCode.NetworkError, `flow-executor вернул HTTP ${res.status}`)
    }
    return (await res.json()) as FlowChallenge
  }

  let challenge = await step()
  for (let i = 0; i < MAX_FLOW_STEPS; i++) {
    if (isFlowSuccess(challenge)) {
      return
    }
    if (challenge.component === 'ak-stage-access-denied') {
      throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, 'Доступ запрещён: проверьте email и пароль')
    }
    const err = firstResponseError(challenge)
    if (err !== null) {
      throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, err || 'Неверный email или пароль')
    }
    switch (challenge.component) {
      case 'ak-stage-identification':
        challenge = await step({ body: { uid_field: email, password } })
        break
      case 'ak-stage-password':
        challenge = await step({ body: { password } })
        break
      default:
        throw new AuthV2Error(
          AuthV2ErrorCode.InvalidCredentials,
          `Стадия входа «${challenge.component ?? challenge.type ?? 'неизвестно'}» не поддерживается CLI`,
        )
    }
  }
  throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, 'Вход не завершён: превышено число шагов flow authentik')
}

function decodeJwtSub(token: string): string {
  const part = token.split('.')[1] ?? ''
  try {
    const claims = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { sub?: string }
    if (claims.sub) {
      return claims.sub
    }
  }
  catch {
    /* упадём ниже единой ошибкой */
  }
  throw new AuthV2Error(AuthV2ErrorCode.SessionBindingExpired, 'binding_token без claim sub')
}

async function authError(res: Response, fallback: AuthV2ErrorCode, msg: string): Promise<AuthV2Error> {
  const body = (await res.json().catch(() => null)) as { error?: string, error_description?: string } | null
  return new AuthV2Error((body?.error as AuthV2ErrorCode) ?? fallback, body?.error_description ?? msg)
}

interface VerifyTokens {
  access_token: string
  refresh_token: string
}

interface SecondFactorChallengeBody {
  second_factor_required: true
  challenge_token: string
  factors: Array<'totp' | 'email'>
}

/**
 * Полный вход по паролю: authentik-сессия → bind (кука доезжает явным заголовком)
 * → vault → подпись метки → verify. При включённом у пайщика подтверждении входа
 * сервер удерживает токены — коды спрашиваем интерактивно через `promptCode`.
 */
export async function coopidLogin(params: CoopIdLoginParams): Promise<CoopIdLoginResult> {
  const apiBase = params.apiUrl.replace(/\/$/, '')
  const issuer = params.issuer ?? new URL(apiBase).origin
  const jar = new CookieJar()

  await authenticateFlow(jar, issuer, params.email, params.password)

  // bind: controller резолвит username по cookie authentik и выпускает binding_token.
  const bindRes = await fetch(`${apiBase}/coop/session/bind`, {
    method: 'POST',
    headers: { cookie: jar.header() },
  })
  if (bindRes.status === 401 || bindRes.status === 403) {
    throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, 'Сессия authentik не подтверждена: неверные email или пароль')
  }
  if (!bindRes.ok) {
    throw await authError(bindRes, AuthV2ErrorCode.NetworkError, `bind вернул HTTP ${bindRes.status}`)
  }
  const bind = (await bindRes.json()) as { binding_token?: string }
  if (!bind.binding_token) {
    throw new AuthV2Error(AuthV2ErrorCode.SessionBindingExpired, 'bind не вернул session_binding_token')
  }
  const username = decodeJwtSub(bind.binding_token)

  // Vault-блоб пайщика расшифровывается паролём локально (ключ на сервер не уходит),
  // расшифрованный ключ живёт в keystore пакета только на время процесса CLI.
  await unlockWallet({ apiUrl: apiBase, account: username, password: params.password })

  const sig = await signTimestamp({ sessionBindingToken: bind.binding_token })
  const verifyRes = await fetch(`${apiBase}/coop/verify/timestamp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ signature: sig.signature, timestamp: sig.ts, binding_token: bind.binding_token }),
  })
  if (!verifyRes.ok) {
    throw await authError(verifyRes, AuthV2ErrorCode.ChainVerificationFailed, `verify вернул HTTP ${verifyRes.status}`)
  }
  const verify = (await verifyRes.json()) as VerifyTokens | SecondFactorChallengeBody

  if ('second_factor_required' in verify) {
    const tokens = await confirmFactors(apiBase, verify, params.promptCode)
    return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, username }
  }
  return { accessToken: verify.access_token, refreshToken: verify.refresh_token, username }
}

/** Последовательное прохождение факторов 2FA-входа интерактивными кодами. */
async function confirmFactors(
  apiBase: string,
  challenge: SecondFactorChallengeBody,
  promptCode: CoopIdLoginParams['promptCode'],
): Promise<VerifyTokens> {
  let factor = challenge.factors[0]
  for (let attempt = 0; attempt < MAX_CODE_PROMPTS * challenge.factors.length; attempt++) {
    if (!factor) {
      break
    }
    const code = await promptCode(factor)
    const res = await fetch(`${apiBase}/coop/verify/2fa/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ challenge_token: challenge.challenge_token, code }),
    })
    if (!res.ok) {
      const err = await authError(res, AuthV2ErrorCode.InvalidTwoFactorCode, `подтверждение входа отклонено (HTTP ${res.status})`)
      // Неверный код — даём ввести ещё раз (лимит попыток держит сервер);
      // остальное (challenge истёк и т.п.) — наверх.
      if (err.code === AuthV2ErrorCode.InvalidTwoFactorCode) {
        console.error(`Код не подошёл: ${err.message}`)
        continue
      }
      throw err
    }
    const body = (await res.json()) as VerifyTokens | { passed_factor: string, next_factor: 'totp' | 'email' }
    if ('access_token' in body) {
      return body
    }
    factor = body.next_factor
  }
  throw new AuthV2Error(AuthV2ErrorCode.InvalidTwoFactorCode, 'Подтверждение входа не завершено')
}
