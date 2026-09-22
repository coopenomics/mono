import type Blockchain from '../../blockchain'

/**
 * Плательщик за оперативную память строки таблицы — аккаунт, с которого цепь
 * списала память под эту строку. Читается запросом `show_payer`.
 */
export async function getRowPayer(
  blockchain: Blockchain,
  code: string,
  scope: string,
  table: string,
  key: string,
  index_position = 1,
  key_type: 'i64' | 'sha256' = 'i64',
): Promise<string | undefined> {
  const result = await blockchain.api.read.getTableRows({
    json: true,
    code,
    scope,
    table,
    limit: 1,
    lower_bound: key,
    upper_bound: key,
    index_position,
    key_type,
    show_payer: true,
  })

  return result.rows[0]?.payer
}
