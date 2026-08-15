import type { IActionQuery, IChainDataSource, ITableQuery } from './index'

/**
 * Источник данных поверх прямых запросов к цепи.
 *
 * Умолчание для тех, у кого нет собственной базы, — инструментов развёртывания
 * и одноразовых сборок документов. Читает таблицы через `get_table_rows` и
 * отбирает нужные строки в памяти: цепь умеет искать только по индексам
 * таблицы, а фабрике нужен отбор по произвольным полям (хэш собрания, номер в
 * реестре). Объёмы этих таблиц исчисляются десятками строк, поэтому такой
 * перебор дешевле, чем поддерживать вторичные индексы под каждый запрос.
 *
 * Историей не располагает: цепь отдаёт только текущее состояние таблицы.
 * `block_num` в запросе игнорируется, и это допустимо ровно потому, что здесь
 * документы собираются «сейчас» — узел для пересборки старых документов
 * использует свою реализацию, с историей версий.
 */
export class ChainRpcDataSource implements IChainDataSource {
  constructor(private readonly chainUrl: string) {}

  async getTableRows<T = any>(query: ITableQuery): Promise<T[]> {
    const rows = await this.fetchAllRows<T>(query.code, query.scope, query.table)
    const filtered = query.filter ? rows.filter(row => matchesFilter(row, query.filter!)) : rows
    return query.limit ? filtered.slice(0, query.limit) : filtered
  }

  /** Истории действий у цепи нет — см. пояснение к IChainDataSource.getActions. */
  async getActions<T = any>(_query: IActionQuery): Promise<T[]> {
    return []
  }

  async getCurrentBlock(): Promise<number> {
    const info = await this.post<{ head_block_num: number }>('/v1/chain/get_info', {})
    return Number(info.head_block_num)
  }

  private async fetchAllRows<T>(code: string, scope: string, table: string): Promise<T[]> {
    const rows: T[] = []
    let lower_bound: string | undefined = ''

    for (let page = 0; page < 10000; page++) {
      const data: { rows: T[], more: boolean, next_key?: string } = await this.post(
        '/v1/chain/get_table_rows',
        { json: true, code, scope, table, limit: 1000, lower_bound },
      )

      rows.push(...data.rows)
      if (!data.more)
        return rows

      lower_bound = data.next_key
    }

    return rows
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.chainUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok)
      throw new Error(`Цепь ответила ${response.status} на ${path}: ${await response.text()}`)

    return await response.json() as T
  }
}

/** Сверяет строку с условием; путь через точку разворачивается вглубь объекта. */
export function matchesFilter(row: any, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([path, expected]) => {
    const actual = path.split('.').reduce<any>((acc, key) => (acc === null || acc === undefined ? acc : acc[key]), row)
    return String(actual) === String(expected)
  })
}
