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
 * Ожидание оплачивается целиком каждый раз, когда кадр не доносит ответ (браузер
 * занят переустановкой service worker'а — см. повтор в `authenticateWithAuthentik`),
 * поэтому оно и есть цена входа в худшем случае: таймаут плюс доля секунды на
 * повтор. Раньше здесь стояло двадцать секунд — на такой вход уходило больше
 * двадцати, и пайщик всё это время смотрел на «думающую» кнопку (случай
 * 23.08.2026 на стенде).
 *
 * Держать большим смысла нет: паузу закрывает не длинное ожидание, а повтор — он
 * выдаёт новый код поверх той же сессии и побочных эффектов не имеет. Удачному
 * входу это ничего не стоит: кадр отвечает за доли секунды, до таймаута дело не
 * доходит вовсе. Запас над обычным ответом оставлен на порядок — медленная сеть
 * в таймаут укладывается, а если нет, повтор всё равно спасает.
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

  // Одна повторная попытка. Скрытый кадр — единственное место входа, которое
  // зависит не только от нас и от authentik, но и от того, чем занят браузер:
  // его переход перехватывает service worker, и если тот в этот момент
  // переустанавливается (а он это делает как раз на переходах, особенно вскоре
  // после релиза), запрос страницы возврата не уходит никуда. Со стороны это
  // выглядит как «вход просто не сработал», хотя пароль верный и authentik уже
  // выдал код — ровно тот случай, что ловили на тестнете 22.08.2026.
  //
  // Повтор занимает доли секунды и к этому моменту рабочий уже сменился, так что
  // вторая попытка проходит. Побочных эффектов нет: prompt=none только выдаёт
  // новый код поверх той же сессии, неиспользованный протухает сам.
  let user: User | null = null
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      user = await um.signinSilent()
      break
    }
    catch (e) {
      lastError = e
    }
  }
  if (!user && lastError) {
    throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, `Не удалось завершить вход через authentik: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
  }
  if (!user)
    throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, 'authentik не вернул сессию после ввода пароля')
  return user
}
