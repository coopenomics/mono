/**
 * Первый этап входа CoopID — password через authentik по Authorization Code + PKCE
 * (FR29: единственный flow для пайщиков; Implicit и ROPC запрещены, RFC 9700).
 * Реализован поверх `oidc-client-ts` (PRD §8). Пароль вводится на форме authentik
 * (попап/редирект), а НЕ передаётся программно — поэтому `LoginParams.password`
 * фасадом не используется (см. oidc/index.ts).
 *
 * Конфигурация (client_id/redirect_uri/scope, база controller'а) задаётся
 * приложением на старте через `configureOidc`/`configureCoopId` — это среда-зависимые
 * параметры (frontend кооператива), не зашитые в SDK.
 */
import { type User, UserManager, type UserManagerSettings } from 'oidc-client-ts'
import { AuthV2Error, AuthV2ErrorCode } from '../errors'

interface OidcClientConfig {
  clientId: string
  redirectUri: string
  scope: string
  postLogoutRedirectUri?: string
}

let oidcConfig: OidcClientConfig | null = null
let coopApiUrl: string | null = null

/** Конфигурация OIDC-клиента authentik (вызывается приложением на старте). */
export function configureOidc(config: { clientId: string, redirectUri: string, scope?: string, postLogoutRedirectUri?: string }): void {
  oidcConfig = {
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    scope: config.scope ?? 'openid profile',
    postLogoutRedirectUri: config.postLogoutRedirectUri,
  }
}

/** База URL controller'а кооператива (для второго этапа: bind/verify/refresh). */
export function configureCoopId(config: { apiUrl: string }): void {
  coopApiUrl = config.apiUrl.replace(/\/$/, '')
}

/** База controller'а или явная ошибка конфигурации. */
export function coopIdApiUrl(): string {
  if (!coopApiUrl)
    throw new AuthV2Error(AuthV2ErrorCode.NetworkError, 'CoopID не сконфигурирован: вызовите configureCoopId({ apiUrl }) на старте приложения')
  return coopApiUrl
}

function userManager(issuer: string): UserManager {
  if (!oidcConfig)
    throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, 'OIDC не сконфигурирован: вызовите configureOidc({ clientId, redirectUri }) на старте приложения')
  const settings: UserManagerSettings = {
    authority: issuer.replace(/\/$/, ''),
    client_id: oidcConfig.clientId,
    redirect_uri: oidcConfig.redirectUri,
    scope: oidcConfig.scope,
    post_logout_redirect_uri: oidcConfig.postLogoutRedirectUri,
    response_type: 'code', // Authorization Code + PKCE; oidc-client-ts включает PKCE по умолчанию.
  }
  return new UserManager(settings)
}

/**
 * Проводит первый этап (password) через authentik в попапе и возвращает OIDC-User
 * (содержит id_token/access_token + устанавливает сессионную cookie authentik,
 * нужную для bind). `loginHint` — email для префилла формы.
 */
export async function authenticateWithAuthentik(params: { issuer: string, loginHint?: string }): Promise<User> {
  const um = userManager(params.issuer)
  try {
    return await um.signinPopup({ login_hint: params.loginHint })
  }
  catch (e) {
    throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, `Не удалось пройти вход через authentik: ${e instanceof Error ? e.message : String(e)}`)
  }
}
