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

/** Приложения каталога на столе подключения и подписки кооператива на них. */
export async function loadProviderApps() {
  const { [Queries.System.GetProviderApps.name]: apps } = await client.Query(
    Queries.System.GetProviderApps.query,
  );
  return apps;
}

export type IProviderAppInput = Mutations.System.SubscribeProviderApp.IInput['data'];

/** Подключить приложение: подписка входит в общий счёт кооператива у провайдера. */
export async function subscribeProviderApp(data: IProviderAppInput) {
  const { [Mutations.System.SubscribeProviderApp.name]: app } = await client.Mutation(
    Mutations.System.SubscribeProviderApp.mutation,
    { variables: { data } },
  );
  return app;
}

/** Отключить приложение: подписка отменяется, приложение снимается с узла. */
export async function cancelProviderApp(data: IProviderAppInput) {
  const { [Mutations.System.CancelProviderApp.name]: app } = await client.Mutation(
    Mutations.System.CancelProviderApp.mutation,
    { variables: { data } },
  );
  return app;
}
