import axios from 'axios';
import { env } from 'src/shared/config';

export interface IPublicProvision {
  title: string;
  html: string;
}

/**
 * Текст публичного положения приходит с бэкенда уже собранным: тот же шаблон из
 * блокчейна и тот же движок подстановки, которыми документ собирается на
 * подпись. Раньше страница собирала текст сама из пакета cooptypes — при таком
 * способе показанная редакция расходилась с принятой ровно тогда, когда версия
 * пакета во фронте отставала от записанной в цепь.
 *
 * Запрос идёт напрямую, а не через типизированный клиент SDK: метод только что
 * появился в схеме, и в SDK он попадёт следующей регенерацией по интроспекции —
 * после неё этот файл заменяется вызовом client.Query.
 */
export async function fetchPublicProvision(registry_id: number): Promise<IPublicProvision> {
  const response = await axios.post(`${env.BACKEND_URL}/v1/graphql`, {
    query: `query GetPublicProvision($data: GetPublicProvisionInput!) {
      getPublicProvision(data: $data) { title html }
    }`,
    variables: { data: { registry_id } },
  });

  const errors = response.data?.errors;
  if (errors?.length) throw new Error(errors[0]?.message ?? 'Не удалось получить текст положения');

  const provision = response.data?.data?.getPublicProvision;
  if (!provision) throw new Error('Не удалось получить текст положения');

  return provision as IPublicProvision;
}
