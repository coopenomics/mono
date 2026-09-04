/**
 * Story 11.2 — встроенный фактор-1 входа CoopID через flow-executor authentik.
 *
 * Зачем НЕ popup/redirect: desktop рисует СВОЮ форму email+password и гонит
 * учётные данные в интерактивный flow-API authentik. Так клиент пайщика ВИДИТ
 * пароль — это нужно, чтобы шифровать им password-vault (Story 11.3); требование
 * вынуждено zero-knowledge-инвариантом vault'а (сервер хранит шифр и расшифровать
 * не может → ключ шифрования обязан быть клиентским секретом, единственный такой
 * секрет — пароль). FR29 при этом соблюдается: запрещённый `grant_type=password`
 * НЕ используется — грант остаётся `authorization_code`+PKCE и выполняется в
 * `client.ts` уже ПОСЛЕ установки сессии (см. `authenticateWithAuthentik`).
 *
 * Топология (Эпик 5, Caddyfile): flow-API доступен same-origin по
 * `{issuer.origin}/api/v3/flows/executor/<slug>/` — Caddy catch-all проксирует всё
 * на authentik под доменом кооператива. `credentials:'include'` доставляет и
 * устанавливает сессионную cookie authentik; CSRF-cookie (`authentik_csrf`) эхо-
 * отправляется в заголовке `X-authentik-CSRF` (authentik требует его на unsafe-
 * методах API). Same-origin критичен: кросс-домен CSRF-cookie не прочитать, а
 * сессионная cookie не доедет до последующего authorize.
 */
import { AuthV2Error, AuthV2ErrorCode } from '../errors'

/** Slug стандартного flow аутентификации authentik (identification → password). */
export const DEFAULT_AUTHENTICATION_FLOW = 'default-authentication-flow'

/** Предохранитель от зацикливания на неожиданной последовательности стадий. */
const MAX_FLOW_STEPS = 8

export interface FlowExecutorParams {
  /** Issuer кооператива (`https://coop.example/application/o/coopid/`); origin — база flow-API. */
  issuer: string
  email: string
  password: string
  /** Slug flow аутентификации authentik (по умолчанию `default-authentication-flow`). */
  flowSlug?: string
}

/** Снимок challenge'а flow-executor (берём только нужные поля; authentik отдаёт больше). */
interface FlowChallenge {
  /** `native` | `redirect` | `shell` — `redirect` означает завершение flow (сессия установлена). */
  type?: string
  /** Web-компонент текущей стадии: `ak-stage-identification`, `ak-stage-password`, … */
  component?: string
  /** Пер-полевые ошибки валидации (неверный пароль → перерисованная стадия с этим полем). */
  response_errors?: Record<string, Array<{ string?: string, code?: string }>>
}

/** Текущий CSRF-токен authentik из cookie (same-origin). В Node/тестах — пусто. */
function csrfHeader(): Record<string, string> {
  if (typeof document === 'undefined' || !document.cookie)
    return {}
  const match = document.cookie.match(/(?:^|;\s*)authentik_csrf=([^;]+)/)
  return match ? { 'X-authentik-CSRF': decodeURIComponent(match[1]) } : {}
}

/**
 * Инвариант same-origin, проверенный до выхода в сеть.
 *
 * Кросс-доменный запрос сюда не просто «неудобен» — он неисполним: CSRF-куку
 * authentik читаем через `document.cookie`, а это доступно только своему
 * источнику. Браузер при этом бракует ответ молча, отдавая `TypeError: Failed
 * to fetch` — сообщение, по которому неотличимы упавший сервер, закрытый порт и
 * несовпадение адреса. На практике адрес и расходится: `127.0.0.1:8108` и
 * `localhost:8108` ведут в один стенд, но для браузера это разные источники.
 *
 * Поэтому проверяем заранее и называем причину. В Node (тесты, SSR) `window`
 * нет — там инварианта не существует, и проверка пропускается.
 */
function assertSameOrigin(base: string): void {
  if (typeof window === 'undefined' || !window.location?.origin)
    return
  const here = window.location.origin
  if (here === base)
    return
  throw new AuthV2Error(
    AuthV2ErrorCode.NetworkError,
    `Вход настроен на ${base}, а страница открыта по ${here}. Для браузера это разные адреса: `
    + `куки и ответ входа он не отдаст. Откройте ${base} — вход возможен только с того же адреса.`,
  )
}

/** URL шага flow-executor. `query` пуст: flow запускается напрямую (authorize делает client.ts). */
function flowUrl(base: string, slug: string): string {
  return `${base}/api/v3/flows/executor/${encodeURIComponent(slug)}/?query=${encodeURIComponent('')}`
}

/** Завершение flow: сессия authentik установлена (redirect-терминал или стадия user-login). */
function isSuccess(c: FlowChallenge): boolean {
  return c.type === 'redirect' || c.component === 'xak-flow-redirect' || c.component === 'ak-stage-user-login'
}

/** Доступ отклонён политикой flow (например, аккаунт неактивен). */
function isAccessDenied(c: FlowChallenge): boolean {
  return c.component === 'ak-stage-access-denied'
}

/**
 * Сообщения authentik приходят по-английски и в интерфейс кооператива попадать не
 * должны: пайщик видел «Failed to authenticate.» на форме входа (04.09.2026).
 * Знакомые сводим к человеческому русскому тексту, незнакомое английское —
 * к общему: показывать сырой ответ чужой системы всё равно нечего, а оригинал
 * уезжает в `details` ошибки для разбора.
 */
const AUTHENTIK_MESSAGES: Record<string, string> = {
  'Failed to authenticate.': 'Неверная почта или пароль',
  'Invalid password': 'Неверная почта или пароль',
  'Invalid credentials': 'Неверная почта или пароль',
  'Invalid token': 'Неверный код подтверждения',
  'Invalid code': 'Неверный код подтверждения',
  'This field may not be blank.': 'Заполните поле',
  'Access denied': 'Вход отклонён. Обратитесь в поддержку кооператива',
}

function humanizeAuthentikMessage(raw: string): string {
  const known = AUTHENTIK_MESSAGES[raw.trim()]
  if (known)
    return known
  // Латиница в тексте = сообщение чужой системы, а не наш текст.
  return /[a-z]/i.test(raw) ? 'Не удалось войти. Проверьте почту и пароль' : raw
}

/** Первое человеко-читаемое сообщение об ошибке валидации из challenge'а (если есть). */
function firstResponseError(c: FlowChallenge): string | null {
  const groups = c.response_errors
  if (!groups)
    return null
  for (const key of Object.keys(groups)) {
    const msg = groups[key]?.find(e => e.string)?.string
    if (msg)
      return msg
  }
  return Object.keys(groups).length > 0 ? '' : null
}

async function getChallenge(url: string): Promise<FlowChallenge> {
  let res: Response
  try {
    res = await fetch(url, { method: 'GET', credentials: 'include', headers: { accept: 'application/json', ...csrfHeader() } })
  }
  catch (e) {
    throw new AuthV2Error(AuthV2ErrorCode.NetworkError, `Сеть недоступна на старте входа: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (!res.ok)
    throw new AuthV2Error(AuthV2ErrorCode.NetworkError, `flow-executor (старт) вернул HTTP ${res.status}`)
  return (await res.json()) as FlowChallenge
}

async function postChallenge(url: string, body: Record<string, unknown>): Promise<FlowChallenge> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'accept': 'application/json', ...csrfHeader() },
      body: JSON.stringify(body),
    })
  }
  catch (e) {
    throw new AuthV2Error(AuthV2ErrorCode.NetworkError, `Сеть недоступна при отправке формы входа: ${e instanceof Error ? e.message : String(e)}`)
  }
  // 400 — authentik перерисовывает ту же стадию с `response_errors` (неверный пароль);
  // это валидное тело challenge'а, читаем его. Остальные не-ok — сетевая/конфиг ошибка.
  if (!res.ok && res.status !== 400)
    throw new AuthV2Error(AuthV2ErrorCode.NetworkError, `flow-executor вернул HTTP ${res.status}`)
  return (await res.json()) as FlowChallenge
}

/**
 * Открывает flow входа заранее, не отправляя учётных данных: обычный GET, тот же,
 * с которого начинается `authenticateWithFlowExecutor`. Ответ не используется —
 * смысл в прогреве authentik и в получении CSRF-cookie до того, как пайщик нажмёт
 * «Войти». Challenge намеренно НЕ переиспользуется: он отражает состояние flow на
 * момент запроса, а между прогревом и вводом пароля проходит сколько угодно времени.
 */
export async function warmUpFlow(issuer: string, flowSlug?: string): Promise<void> {
  const base = new URL(issuer).origin
  assertSameOrigin(base)
  await getChallenge(flowUrl(base, flowSlug ?? DEFAULT_AUTHENTICATION_FLOW))
}

/**
 * Проводит фактор-1 (email+password) через flow-executor authentik и устанавливает
 * сессионную cookie. Возвращает `void` при успехе (сессия — побочный эффект cookie),
 * бросает `AuthV2Error(InvalidCredentials)` при неверных учётных данных / отказе и
 * `AuthV2Error(NetworkError)` при сетевом сбое.
 *
 * Поддерживаются стандартные стадии `ak-stage-identification` и `ak-stage-password`
 * (в т.ч. совмещённая identification с `password_fields`). Интерактивные стадии
 * вне scope встроенной формы (MFA-валидация, consent) → InvalidCredentials с
 * пояснением: их обрабатывает отдельный эпик динамического 2FA.
 */
export async function authenticateWithFlowExecutor(params: FlowExecutorParams): Promise<void> {
  const base = new URL(params.issuer).origin
  assertSameOrigin(base)
  const url = flowUrl(base, params.flowSlug ?? DEFAULT_AUTHENTICATION_FLOW)

  let challenge = await getChallenge(url)
  for (let step = 0; step < MAX_FLOW_STEPS; step++) {
    if (isSuccess(challenge))
      return

    if (isAccessDenied(challenge))
      throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, 'Доступ запрещён: проверьте email и пароль')

    const err = firstResponseError(challenge)
    if (err !== null) {
      throw new AuthV2Error(
        AuthV2ErrorCode.InvalidCredentials,
        err ? humanizeAuthentikMessage(err) : 'Неверный email или пароль',
        err ? { authentik_message: err } : undefined,
      )
    }

    switch (challenge.component) {
      case 'ak-stage-identification':
        // Совмещённая identification может ждать и пароль (`password_fields`) — отдаём оба.
        challenge = await postChallenge(url, { uid_field: params.email, password: params.password })
        break
      case 'ak-stage-password':
        challenge = await postChallenge(url, { password: params.password })
        break
      default:
        throw new AuthV2Error(
          AuthV2ErrorCode.InvalidCredentials,
          `Стадия входа «${challenge.component ?? challenge.type ?? 'неизвестно'}» не поддерживается встроенной формой`,
        )
    }
  }
  throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, 'Вход не завершён: превышено число шагов flow authentik')
}
