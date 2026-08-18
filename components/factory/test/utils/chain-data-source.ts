import type { IActionQuery, IChainDataSource, ITableQuery } from '../../src/DataSource'
import { getFetch } from '../../src/Utils/getFetch'

/**
 * Данные цепи для набора тестов.
 *
 * Фабрика больше не ходит за ними сама: откуда читать — решает тот, кто её
 * создаёт (см. `src/DataSource/index.ts`). У тестов свой источник — набор
 * фикстур, который и раньше отвечал за фабрику: таблицы и действия лежат в
 * монге, наполняемой `preLoading()`, а подставляет их слой `getFetch` при
 * `NODE_ENV=test`, не выходя в сеть.
 *
 * Поэтому здесь не новая мок-инфраструктура, а переходник к прежней: запрос в
 * терминах `IChainDataSource` перекладывается в тот же вид отбора, который
 * фикстуры понимают (`code`/`table`/`value.поле` для таблиц,
 * `account`/`name`/`data.поле` для действий).
 */
export class TestChainDataSource implements IChainDataSource {
  /** Хост не проверяется — фикстуры сопоставляются по пути и отбору. */
  private readonly base = process.env.SIMPLE_EXPLORER_API ?? 'http://127.0.0.1:4000'

  async getTableRows<T = any>(query: ITableQuery): Promise<T[]> {
    const filter: Record<string, unknown> = {
      code: query.code,
      scope: query.scope,
      table: query.table,
    }
    for (const [field, value] of Object.entries(query.filter ?? {}))
      filter[`value.${field}`] = value

    const response = await getFetch(`${this.base}/get-tables`, new URLSearchParams({
      filter: JSON.stringify(filter),
    }))

    // Фикстуры отдают строки дельтами — сама строка таблицы лежит в `value`.
    const rows = (response?.results ?? []).map((row: any) => row?.value ?? row)

    return (query.limit ? rows.slice(0, query.limit) : rows) as T[]
  }

  async getActions<T = any>(query: IActionQuery): Promise<T[]> {
    const filter: Record<string, unknown> = { account: query.account }
    if (query.name) filter.name = query.name
    for (const [field, value] of Object.entries(query.data ?? {}))
      filter[`data.${field}`] = value

    const response = await getFetch(`${this.base}/get-actions`, new URLSearchParams({
      filter: JSON.stringify(filter),
    }))

    const actions = response?.results ?? []

    return (query.limit ? actions.slice(0, query.limit) : actions) as T[]
  }

  /**
   * Высота цепи в наборе тестов зафиксирована нулём — тем же значением, что
   * отдаёт `getCurrentBlock` при `SKIP_BLOCK_FETCH=TRUE`. Иначе метаданные
   * документа плавали бы от прогона к прогону.
   */
  async getCurrentBlock(): Promise<number> {
    return 0
  }
}
