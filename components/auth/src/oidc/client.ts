/**
 * Первый этап входа CoopID (Story 11.2) — password через authentik:
 * (1) встроенная форма гонит email+password в flow-executor authentik и
 * устанавливает сессию (`flow-executor.ts`); (2) `oidc-client-ts` выполняет
 * `authorization_code`+PKCE МОЛЧА (`signinSilent`, prompt=none) — сессия уже есть,
 * второго ввода пароля нет. Так клиент видит пароль (нужно для vault, Story 11.3),
 * не нарушая FR29: запрещённый `grant_type=password` не используется, грант —
 * стандартный authorization_code+PKCE (Implicit и ROPC запрещены, RFC 9700).
 *
 * Конфигурация (client_id/redirect_uri/scope, база controller'а) задаётся
 * приложением на старте через `configureOidc`/`configureCoopId` — это среда-зависимые
 * параметры (frontend кооператива), не зашитые в SDK.
 */
import { type User, UserManager, type UserManagerSettings } from 'oidc-client-ts'
import { AuthV2Error, AuthV2ErrorCode } from '../errors'
import { authenticateWithFlowExecutor, warmUpFlow } from './flow-executor'

interface OidcClientConfig {
  clientId: string
  redirectUri: string
  scope: string
  postLogoutRedirectUri?: string
  /** redirect_uri скрытого silent-iframe для prompt=none authorize (Story 11.2). */
  silentRedirectUri?: string
}

let oidcConfig: OidcClientConfig | null = null
let coopApiUrl: string | null = null

/** Конфигурация OIDC-клиента authentik (вызывается приложением на старте). */
export function configureOidc(config: { clientId: string, redirectUri: string, scope?: string, postLogoutRedirectUri?: string, silentRedirectUri?: string }): void {
  oidcConfig = {
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    scope: config.scope ?? 'openid profile',
    postLogoutRedirectUri: config.postLogoutRedirectUri,
    silentRedirectUri: config.silentRedirectUri,
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

/**
 * UserManager'ы по issuer. Раньше на каждый вход создавался новый — вместе с ним
 * заново создавался и кэш метаданных, поэтому `.well-known/openid-configuration`
 * запрашивался при каждом входе, добавляя round-trip к authentik прямо в момент,
 * когда пайщик ждёт. Общий экземпляр позволяет прогреть метаданные заранее
 * (`warmUpAuthentik`), пока пайщик ещё печатает.
 */
const managers = new Map<string, UserManager>()

function userManager(issuer: string): UserManager {
  if (!oidcConfig)
    throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, 'OIDC не сконфигурирован: вызовите configureOidc({ clientId, redirectUri }) на старте приложения')
  const authority = issuer.replace(/\/$/, '')
  const cached = managers.get(authority)
  if (cached)
    return cached
  const settings: UserManagerSettings = {
    authority,
    client_id: oidcConfig.clientId,
    redirect_uri: oidcConfig.redirectUri,
    silent_redirect_uri: oidcConfig.silentRedirectUri ?? oidcConfig.redirectUri,
    scope: oidcConfig.scope,
    post_logout_redirect_uri: oidcConfig.postLogoutRedirectUri,
    response_type: 'code', // Authorization Code + PKCE; oidc-client-ts включает PKCE по умолчанию.
  }
  const um = new UserManager(settings)
  managers.set(authority, um)
  return um
}

/**
 * Прогрев authentik: тянет метаданные OIDC и открывает flow входа, пока пайщик
 * заполняет форму. Обе операции — обычные GET'ы, побочных эффектов у них нет
 * (сессию устанавливает только отправка пароля), поэтому вызывать безопасно и
 * повторно.
 *
 * Зачем: authentik отвечает на первый запрос заметно дольше, чем на последующие
 * (прогрев воркера), а метаданные и стартовый challenge всё равно потребуются.
 * Выполненные заранее, они уходят из времени ожидания пайщика целиком.
 *
 * Ошибки намеренно гасятся: прогрев — оптимизация, его провал не должен мешать
 * входу, все те же запросы будут честно повторены в `authenticateWithAuthentik`.
 */
export async function warmUpAuthentik(params: { issuer: string, flowSlug?: string }): Promise<void> {
  try {
    await Promise.all([
      userManager(params.issuer).metadataService.getMetadata(),
      warmUpFlow(params.issuer, params.flowSlug),
    ])
  }
  catch {
    // намеренно молча — см. док-комментарий
  }
}

/**
 * Проводит первый этап входа и возвращает OIDC-User (id_token/access_token +
 * установленная сессионная cookie authentik, нужная для bind). Story 11.2:
 * (1) встроенная форма → flow-executor authentik устанавливает сессию (фактор 1);
 * (2) `signinSilent` выполняет authorization_code+PKCE молча (сессия уже есть,
 * prompt=none через скрытый iframe `silent_redirect_uri`) — без попапа и без
 * повторного ввода пароля.
 */
export async function authenticateWithAuthentik(params: { issuer: string, email: string, password: string, flowSlug?: string }): Promise<User> {
  // Фактор-1: учётные данные уходят в authentik (а не в наш backend) — ROPC не используется.
  await authenticateWithFlowExecutor({ issuer: params.issuer, email: params.email, password: params.password, flowSlug: params.flowSlug })
  // Грант FR29: code+PKCE поверх уже установленной сессии, без интерактивного UI.
  const um = userManager(params.issuer)
  let user: User | null
  try {
    user = await um.signinSilent()
  }
  catch (e) {
    throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, `Не удалось завершить вход через authentik: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (!user)
    throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, 'authentik не вернул сессию после ввода пароля')
  return user
}
