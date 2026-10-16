import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';

/**
 * Получить подписки пользователя у провайдера
 */
export async function loadProviderSubscriptions() {
  const { [Queries.System.GetProviderSubscriptions.name]: subscriptions } =
    await client.Query(Queries.System.GetProviderSubscriptions.query);

  return subscriptions;
}

export type ISelectProviderTariffInput = Mutations.System.SelectProviderTariff.IInput['data'];

/**
 * Передать провайдеру тариф, выбранный в мастере подключения: по нему
 * провайдер заказывает сервер и заводит подписки тарифа.
 */
export async function selectProviderTariff(data: ISelectProviderTariffInput) {
  const { [Mutations.System.SelectProviderTariff.name]: result } = await client.Mutation(
    Mutations.System.SelectProviderTariff.mutation,
    { variables: { data } },
  );
  return result;
}
