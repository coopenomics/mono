/**
 * Настройки выплат поставщика Стола заказов: на какие реквизиты (платёжный
 * метод ядра из раздела «Реквизиты» пайщика) поставщик получает выплаты по
 * актам приёмки. Используются двумя столами — страницей «Выплаты» (выбор
 * реквизитов) и мастером предложения (гейт публикации без реквизитов),
 * поэтому API вынесен в общий entity-слой.
 */
import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type MarketplaceSupplierPaymentSettingsView =
  Queries.Marketplace.GetSupplierPaymentSettings.IOutput['marketplaceGetSupplierPaymentSettings'];

export async function loadSupplierPaymentSettings(): Promise<MarketplaceSupplierPaymentSettingsView> {
  const { [Queries.Marketplace.GetSupplierPaymentSettings.name]: result } = await client.Query(
    Queries.Marketplace.GetSupplierPaymentSettings.query,
    {},
  );
  return result;
}

export async function setSupplierPayoutMethod(
  method_id: string,
): Promise<MarketplaceSupplierPaymentSettingsView> {
  const { [Mutations.Marketplace.SetSupplierPayoutMethod.name]: result } = await client.Mutation(
    Mutations.Marketplace.SetSupplierPayoutMethod.mutation,
    { variables: { input: { method_id } } },
  );
  return result;
}
