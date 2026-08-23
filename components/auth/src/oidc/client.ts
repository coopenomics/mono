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
/**
 * Сколько ждать ответа скрытого кадра, прежде чем считать попытку потерянной.
 *
 * Кадр теперь запасной путь: код авторизации забирает `signinViaFetch`, а сюда
 * доходят только те входы, у которых основной путь не удался. Поэтому ожидание
 * складывается с уже потраченным на неудачный запрос и целиком видно пайщику как
 * «кнопка думает».
 *
 * Раньше здесь стояло двадцать секунд, и это была не теория: на стенде
 * 23.08.2026 вход занял двадцать одну секунду при том, что сервер отвечал за
 * доли секунды (bind 391 мс, метка времени 405 мс, authentik 0.3–1 с). Кадр
 * тогда был основным путём, браузер его оборвал — nginx записал 499 и ни одного
 * запроса страницы возврата, — и всё это время ушло в холостое ожидание.
 *
 * Держать большим незачем и сейчас: потерянный кадр ожиданием не спасёшь, а
 * удачному входу порог не стоит ничего — кадр отвечает за доли секунды, до
 * таймаута дело не доходит. Запас над обычным ответом оставлен на порядок, чтобы
 * медленная сеть в него укладывалась.
 */
export const SILENT_REQUEST_TIMEOUT_SECONDS = 7

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
    silentRequestTimeoutInSeconds: SILENT_REQUEST_TIMEOUT_SECONDS,
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
  // Кадр — навигация, и у навигации есть побочный эффект, который нам не
  // принадлежит: браузер на ней проверяет обновление service worker'а. Вскоре
  // после релиза проверка находит новый рабочий, тот начинает прекэш всех
  // ассетов стола (сотни файлов) — и переход кадра на страницу возврата до сети
  // не доходит вовсе: на проде 23.08.2026 и на тестнете днём раньше в журнале
  // всех трёх nginx есть `authorize → 302` и нет ни одного `callback.html`, зато
  // ровно между ними лежит свежий `service-worker.js`. Библиотека ждёт и валит
  // вход «IFrame timed out». Повтор того же кадра не помогал: он снова
  // навигация, снова с той же проверкой.
  //
  // `fetch` навигацией не является: проверку рабочего не запускает и под его
  // кэш-стратегии не попадает. authentik отвечает 302 на страницу возврата,
  // `redirect: 'follow'` доводит до неё, и конечный адрес с кодом лежит в
  // `response.url` — ровно то, что кадр должен был отдать через postMessage.
  // Дальше обмен кода на токены делает та же библиотека, только без кадра.
  //
  // Кадр оставлен запасным путём на случай, когда запрос не удался по сетевой
  // причине, — терять рабочий сценарий ради нового смысла нет.
  let user: User | null = null
  try {
    user = await signinViaFetch(um)
  }
  catch (fetchError) {
    try {
      user = await um.signinSilent()
    }
    catch (iframeError) {
      const first = fetchError instanceof Error ? fetchError.message : String(fetchError)
      const second = iframeError instanceof Error ? iframeError.message : String(iframeError)
      throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, `Не удалось завершить вход через authentik: ${first}; запасной путь: ${second}`)
    }
  }
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
