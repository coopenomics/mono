import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type IGetPublicProvisionInput = Queries.Documents.GetPublicProvision.IInput['data'];

/**
 * Текст публичного положения приходит с бэкенда уже собранным: тот же шаблон из
 * блокчейна и тот же движок подстановки, которыми документ собирается на
 * подпись. Собирать текст на клиенте нельзя — это вторая копия логики фабрики
 * документов, и показанная редакция расходится с принятой ровно тогда, когда
 * версия пакета во фронте отстаёт от записанной в цепь.
 */
export async function fetchPublicProvision(data: IGetPublicProvisionInput) {
  const { [Queries.Documents.GetPublicProvision.name]: result } = await client.Query(
    Queries.Documents.GetPublicProvision.query,
    { variables: { data } }
  );

  return result;
}
