/**
 * Фикстуры цепи для набора тестов — в памяти процесса.
 *
 * Строки таблиц (дельты) и действия, которые при `NODE_ENV=test` отдают
 * заглушки `getFetch`. Раньше они лежали в MongoDB набора и наполнялись
 * глобальной подготовкой; хранилище фабрики переехало в PostgreSQL, и
 * фикстуры цепи держатся здесь. Наполняет их подготовка каждого файла набора
 * (`test/utils`, `seedChainFixtures`), заглушки только читают.
 */
type Row = Record<string, any>

export const chainFixtures: { deltas: Row[], actions: Row[] } = { deltas: [], actions: [] }

export function resetChainFixtures(): void {
  chainFixtures.deltas = []
  chainFixtures.actions = []
}

function valueAt(row: Row, path: string): unknown {
  return path.split('.').reduce<any>((acc, key) => (acc == null ? undefined : acc[key]), row)
}

/** Строки, у которых каждое поле отбора (путь через точку) равно значению; новее блок — раньше. */
export function findFixtures(rows: Row[], query: Record<string, unknown>): Row[] {
  const matched = rows.filter(row => Object.entries(query).every(([path, value]) => valueAt(row, path) === value))
  return matched.sort((a, b) => Number(b.block_num ?? 0) - Number(a.block_num ?? 0))
}
