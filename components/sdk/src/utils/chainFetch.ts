/**
 * Перехват ответов узла цепи.
 *
 * Все обращения к цепи — и чтение, и отправка транзакций — уходят через `fetch`
 * сессии wharfkit. Это единственное место, где ответ узла виден целиком: дальше
 * `session.transact` подменяет `APIError` на `new Error(details[0].message)`, и
 * от ответа остаётся одна строка без кода, имени исключения и остальных
 * подробностей. Поэтому разбор отказов цепи делается ЗДЕСЬ, а не в местах, где
 * ошибка всплывает.
 *
 * Инцидент 17.09.2026: `POST /api/v1/chain/send_transaction` со страницы
 * повестки совета ответил 500, и по логам восстановить причину не удалось —
 * ответ узла нигде не сохранялся.
 */

/** Разобранный отказ узла — то, что осталось бы неизвестным без перехвата. */
export interface ChainFailure {
  /** Полный адрес запроса. */
  url: string
  /** Путь вида `/v1/chain/send_transaction` — по нему видно, что делали. */
  path: string
  /** Код ответа HTTP; узлы Antelope отвечают 500 на любую отклонённую транзакцию. */
  httpStatus: number
  /** Код исключения цепи (3080004 — не уложились в CPU, 3050003 — ассерт контракта). */
  code?: number
  /** Имя исключения цепи (`tx_cpu_usage_exceeded`, `eosio_assert_message_exception`). */
  name?: string
  /** Короткое описание отказа (`error.what`). */
  message: string
  /** Подробности отказа: для ассерта контракта здесь его текст. */
  details: string[]
  /** Тело ответа как есть, обрезанное — на случай, если разбор не удался. */
  raw: string
}

/** Сколько символов тела ответа сохраняем: ассерт короткий, трассировка — нет. */
const RAW_LIMIT = 4000

/** Тип `fetch`, который ждёт wharfkit. */
type FetchLike = (input: any, init?: any) => Promise<any>

function parseFailure(url: string, status: number, body: string): ChainFailure {
  const failure: ChainFailure = {
    url,
    path: safePath(url),
    httpStatus: status,
    message: '',
    details: [],
    raw: body.slice(0, RAW_LIMIT),
  }

  try {
    const parsed = JSON.parse(body)
    const error = parsed?.error
    if (error) {
      failure.code = typeof error.code === 'number' ? error.code : undefined
      failure.name = typeof error.name === 'string' ? error.name : undefined
      failure.message = String(error.what ?? parsed.message ?? '')
      failure.details = Array.isArray(error.details)
        ? error.details.map((detail: any) => String(detail?.message ?? '')).filter(Boolean)
        : []
    }
    else {
      failure.message = String(parsed?.message ?? '')
    }
  }
  catch {
    // Тело не JSON (страница ошибки прокси, обрыв) — остаётся `raw`.
    failure.message = body.slice(0, 200)
  }

  return failure
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname
  }
  catch {
    return url
  }
}

/**
 * Обёртка над `fetch` для сессии цепи: при неуспешном ответе разбирает тело и
 * отдаёт его наблюдателю, после чего возвращает ответ вызывающему нетронутым.
 *
 * Наблюдатель не имеет права ломать запрос: его исключение здесь гасится — иначе
 * сбой журналирования превратился бы в сбой операции пайщика.
 */
export function createChainFetch(onFailure: (failure: ChainFailure) => void, baseFetch?: FetchLike): FetchLike {
  return async function chainFetch(input: any, init?: any): Promise<any> {
    const fetchImpl: FetchLike = baseFetch ?? (globalThis.fetch as unknown as FetchLike)
    const response = await fetchImpl(input, init)

    if (response?.ok !== false) return response

    try {
      // Читаем копию: тело ответа одноразовое, и вызывающий разберёт его сам.
      const body = await response.clone().text()
      const url = String(response.url || (typeof input === 'string' ? input : input?.url) || '')
      onFailure(parseFailure(url, Number(response.status) || 0, body))
    }
    catch {
      // Не смогли прочитать копию — молчим: ответ вызывающему важнее журнала.
    }

    return response
  }
}

/** Человекочитаемая строка отказа для журнала. */
export function describeChainFailure(failure: ChainFailure): string {
  const head = `${failure.path} → HTTP ${failure.httpStatus}`
  const code = failure.code ? ` [${failure.code}${failure.name ? ` ${failure.name}` : ''}]` : ''
  const what = failure.message ? `: ${failure.message}` : ''
  const details = failure.details.length ? ` — ${failure.details.join('; ')}` : ''
  return `${head}${code}${what}${details}`
}
