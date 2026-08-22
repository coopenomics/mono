import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';

/**
 * Получить подписки пользователя у провайдера
 */
export async function loadProviderSubscriptions() {
  const { [Queries.System.GetProviderSubscriptions.name]: subscriptions } =
    await client.Query(Queries.System.GetProviderSubscriptions.query);

  return subscriptions;
}
