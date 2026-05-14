import { rpc } from '../eos';
import { RegistratorContract } from 'cooptypes';

/**
 * Возвращает список coopname-ов всех активных кооперативов из
 * `registrator::cooperatives2`. Используется как драйвер per-coop миграций.
 */
export async function listCoops(): Promise<string[]> {
  const result: string[] = [];
  let lower_bound: string | undefined;

  while (true) {
    const rows = await rpc.get_table_rows({
      json: true,
      code: RegistratorContract.contractName.production,
      scope: RegistratorContract.contractName.production,
      table: RegistratorContract.Tables.Cooperatives.tableName,
      limit: 100,
      lower_bound,
    });

    for (const row of rows.rows as Array<{ username: string; is_cooperative: boolean; status?: string }>) {
      if (row.is_cooperative && (row.status === undefined || row.status === 'active')) {
        result.push(row.username);
      }
    }

    if (!rows.more) break;
    lower_bound = rows.next_key;
  }

  return result;
}
