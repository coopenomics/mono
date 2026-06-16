import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

/**
 * Онбординг поставщика: чтение записи пайщика в реестре поставщиков и подача
 * заявки на допуск по членской модели (номер + дата бумажного договора).
 *
 * Модель работы при заявке всегда членская (боевая — заглушка, заключается
 * отдельным электронным ДУХД позже). Прямое добавление и одобрение заявок —
 * на столе администратора, см. SupplierRegistry.
 */

export type MarketplaceSupplierStateView =
  Queries.Marketplace.MySupplierState.IOutput['marketplaceMySupplierState'];

export type IRequestSupplierInput = Mutations.Marketplace.RequestSupplier.IInput['input'];

export async function fetchMySupplierState(): Promise<MarketplaceSupplierStateView> {
  const { [Queries.Marketplace.MySupplierState.name]: result } = await client.Query(
    Queries.Marketplace.MySupplierState.query,
    {},
  );
  return result;
}

export async function requestSupplier(
  input: IRequestSupplierInput,
): Promise<MarketplaceSupplierStateView> {
  const { [Mutations.Marketplace.RequestSupplier.name]: result } = await client.Mutation(
    Mutations.Marketplace.RequestSupplier.mutation,
    { variables: { input } },
  );
  return result;
}
