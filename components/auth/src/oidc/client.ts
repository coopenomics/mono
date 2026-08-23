/**
 * Первый этап входа CoopID (Story 11.2) — password через authentik:
 * (1) встроенная форма гонит email+password в flow-executor authentik и
 * устанавливает сессию (`flow-executor.ts`); (2) `oidc-client-ts` выполняет
 * `authorization_code`+PKCE МОЛЧА (prompt=none, обычным запросом — см.
 * `signinViaFetch`) — сессия уже есть,
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
  /** redirect_uri для prompt=none authorize: страница возврата, с которой читается код. */
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
 * (2) authorization_code+PKCE выполняется молча (сессия уже есть, prompt=none) —
 * без попапа, без кадра и без повторного ввода пароля.
 */
export async function authenticateWithAuthentik(params: { issuer: string, email: string, password: string, flowSlug?: string }): Promise<User> {
  // Фактор-1: учётные данные уходят в authentik (а не в наш backend) — ROPC не используется.
  await authenticateWithFlowExecutor({ issuer: params.issuer, email: params.email, password: params.password, flowSlug: params.flowSlug })
  // Грант FR29: code+PKCE поверх уже установленной сессии, без интерактивного UI.
  const um = userManager(params.issuer)

  // Прежде сохранённого пайщика убираем ДО тихого запроса.
  //
  // Тихий запрос задуман как продление уже идущей сессии, поэтому библиотека
  // сверяет, что вернулся тот же человек, что лежит в хранилище вкладки, и при
  // расхождении сообщает `login_required` — будто входа не было вовсе. Но здесь
  // тихий запрос стоит сразу за вводом пароля: кто вошёл, только что решил сам
  // пайщик, и сверяться со старой записью не с чем — она осталась от прошлого
  // входа. Расхождение возникает на ровном месте в двух обычных случаях: на
  // одном устройстве входят по очереди разные пайщики, и после переустановки
  // кооператива тот же пайщик заводится заново (учётная запись новая, хотя имя
  // прежнее). Тогда вход падал с «login_required», хотя пароль верный и
  // удостоверение уже выдано — лечилось только закрытием вкладки.
  await um.removeUser().catch(() => undefined)
  await um.clearStaleState().catch(() => undefined)

  // Код авторизации забираем ОБЫЧНЫМ запросом, а не скрытым кадром.
  //
  // Кадр в OIDC существует ради общего случая: у обычного провайдера эндпоинт
  // authorize живёт на ЧУЖОМ origin, и прочитать его ответ кодом нельзя — CORS
  // на него не выдаётся, а сессионную куку провайдера надо ещё и приложить.
  // Кадр обходит это тем, что он навигация, а не запрос: куки уходят сами,
  // результат возвращается на страницу возврата и оттуда postMessage'ем.
  // Библиотека общего назначения иначе и не может.
  //
  // У нас этого ограничения нет: authentik и рабочий стол стоят за одним nginx
  // на одном домене (`/if/`, `/application/o/`, `/api/v3/` → authentik, `/` →
  // стол). Единый origin выбран ради кук, но попутно снял и CORS — значит
  // authorize можно просто запросить, пройти редирект и прочитать конечный адрес.
  //
  // Ради чего меняли: кадр НЕ ПОКАЗЫВАЕТ отказы провайдера. authentik отдаёт
  // `X-Frame-Options: DENY` на всех своих страницах, поэтому страница ошибки в
  // кадре не отображается, ответа не приходит, и любой отказ на authorize —
  // хоть 400, хоть 500 — выглядит одинаково: «IFrame timed out without a
  // response». На проде 23.08.2026 за этой формулировкой полдня прятался
  // тривиальный `redirect_uri_no_match` (в authentik был записан кириллический
  // домен, а браузер шлёт punycode). Запрос отдаёт код ответа как есть, и такой
  // отказ читается сразу.
  //
  // Запасного пути через кадр здесь намеренно НЕТ. Он не спасал: origin, эндпоинт,
  // куки и сессия те же самые — получив 400 запросом, кадр получит тот же 400 и
  // только спрячет его за таймаутом, добавив ожидание и склеенное из двух частей
  // сообщение. Ошибка обновления библиотеки (см. `signinViaFetch`) ловится сборкой
  // типов, а не пайщиком, — страховать её в рантайме нечем и незачем.
  const user = await signinViaFetch(um)
  if (!user)
    throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, 'authentik не вернул сессию после ввода пароля')
  return user
}

/**
 * Тихий вход без кадра: authorize с prompt=none обычным запросом с куками, код
 * — из конечного адреса после редиректов, обмен на токены — библиотекой.
 *
 * Внутренние методы библиотеки (`_client`, `_signinEnd`) объявлены protected;
 * публичного способа «обработать ответ authorize, полученный не кадром» у неё
 * нет, хотя вся логика (state в хранилище, PKCE, валидация, сборка User)
 * именно там. Берём их явно и по имени — если в новой версии они переименуются,
 * это упадёт на сборке типов, а не молча в рантайме.
 */
async function signinViaFetch(um: UserManager): Promise<User> {
  const internals = um as unknown as {
    _client: { createSigninRequest: (args: Record<string, unknown>) => Promise<{ url: string }> }
    _signinEnd: (url: string) => Promise<User>
  }
  const { url } = await internals._client.createSigninRequest({
    request_type: 'si:s',
    redirect_uri: um.settings.silent_redirect_uri,
    prompt: 'none',
  })

  // Та же сессия authentik, что установил flow-executor, — поэтому `include`.
  const response = await fetch(url, { credentials: 'include', redirect: 'follow' })
  // authentik отвечает 302 на страницу возврата — она статическая и отдаёт 200;
  // адрес, на котором запрос закончился, и несёт code+state (или error).
  const finalUrl = response.url
  if (!finalUrl || !/[?#].*(?:code|error)=/.test(finalUrl))
    throw new Error(`authentik не вернул код авторизации (ответ ${response.status} на ${finalUrl || url})`)

  return internals._signinEnd(finalUrl)
}
