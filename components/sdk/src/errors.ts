/**
 * Одна ошибка из ответа GraphQL-сервера. Форма стандартная: текст, необязательные
 * `extensions` (код, подробности — например `CONTENT_CONFLICT` с обеими редакциями)
 * и путь до поля, на котором запрос упал.
 */
export interface GraphQLErrorItem {
  message: string
  extensions?: Record<string, unknown>
  path?: Array<string | number>
  [key: string]: unknown
}

/**
 * Отказ GraphQL-запроса, пришедший от сервера.
 *
 * Раньше SDK бросал сырой массив `json.errors`, а при HTTP-ответе не 2xx — разобранное
 * тело или строку. Ни то ни другое не `Error`: без `message` и стека. В журнале ошибок
 * такие отказы выглядели как «Object captured as promise rejection with keys: …» или
 * «Error: [object Object]», `console.error` печатал `[object Object]`, а код с проверкой
 * `e instanceof Error` их не узнавал.
 *
 * Теперь наружу уходит настоящая ошибка. Старая форма сохранена полем `errors`:
 * обработчики, которые разбирали массив (`extractGraphQLErrorMessages`, `isGraphQLError`,
 * диалог конфликта редакций), продолжают работать через него без правок.
 */
export class GraphQLResponseError extends Error {
  /** Исходный список ошибок сервера — та самая форма, что раньше бросалась целиком. */
  readonly errors: GraphQLErrorItem[]
  /** Весь ответ сервера (разобранное тело; при неразобранном JSON — строка). */
  readonly response: unknown
  /** HTTP-статус ответа. */
  readonly status: number

  constructor(errors: GraphQLErrorItem[], options: { response: unknown, status: number }) {
    super(formatGraphQLErrorMessage(errors, options.status))
    this.name = 'GraphQLResponseError'
    this.errors = errors
    this.response = options.response
    this.status = options.status
  }

  /** Код из `extensions.code` первой ошибки, если сервер его прислал. */
  get code(): string | undefined {
    const code = this.errors[0]?.extensions?.code
    return typeof code === 'string' ? code : undefined
  }
}

/**
 * Разобрать тело HTTP-ответа не 2xx в список ошибок той же формы, что `json.errors`.
 *
 * Сервер может ответить и GraphQL-конвертом (`{ errors: [...] }`), и REST-конвертом
 * NestJS (`{ statusCode, message }`), и голым текстом от прокси («502 Bad Gateway»).
 * Все три сводятся к одной форме, чтобы обработчики не зависели от того, кто ответил.
 */
export function graphQLErrorsFromBody(body: unknown, status: number): GraphQLErrorItem[] {
  if (body && typeof body === 'object') {
    const errors = (body as { errors?: unknown }).errors
    if (Array.isArray(errors) && errors.length > 0)
      return errors as GraphQLErrorItem[]
    const message = (body as { message?: unknown }).message
    if (typeof message === 'string' && message.length > 0)
      return [{ message, extensions: { code: status } }]
    if (Array.isArray(message) && message.length > 0)
      return [{ message: message.join('; '), extensions: { code: status } }]
  }
  if (typeof body === 'string') {
    // Прокси отвечает HTML-страницей («502 Bad Gateway»): в сообщение идёт её
    // текст без разметки, коротко — этот текст видит пайщик и журнал ошибок.
    const plain = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    if (plain.length > 0)
      return [{ message: plain.slice(0, 200), extensions: { code: status } }]
  }
  return [{ message: `HTTP ${status}`, extensions: { code: status } }]
}

function formatGraphQLErrorMessage(errors: GraphQLErrorItem[], status: number): string {
  const text = errors
    .map(e => (typeof e?.message === 'string' ? e.message : ''))
    .filter(s => s.length > 0)
    .join('; ')
  return text || `GraphQL request failed (HTTP ${status})`
}
