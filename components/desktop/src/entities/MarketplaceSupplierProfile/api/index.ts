/**
 * Профиль поставщика Стола заказов: кто поставщик, что он рассказывает о себе,
 * сколько у него предложений и как его оценивают. Читают его все столы,
 * правят поставщик (свой) и администратор (профиль кооператива).
 */
import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type MarketplaceSupplierProfileView =
  Queries.Marketplace.SupplierProfile.IOutput['marketplaceSupplierProfile'];

export type IUpdateSupplierProfileInput = Mutations.Marketplace.UpdateMySupplierProfile.IInput['data'];

export async function loadSupplierProfile(supplier_account: string): Promise<MarketplaceSupplierProfileView> {
  const { [Queries.Marketplace.SupplierProfile.name]: profile } = await client.Query(
    Queries.Marketplace.SupplierProfile.query,
    { variables: { supplier_account } },
  );
  return profile;
}

export async function updateMySupplierProfile(
  data: IUpdateSupplierProfileInput,
): Promise<MarketplaceSupplierProfileView> {
  const { [Mutations.Marketplace.UpdateMySupplierProfile.name]: profile } = await client.Mutation(
    Mutations.Marketplace.UpdateMySupplierProfile.mutation,
    { variables: { data } },
  );
  return profile;
}

export async function updateCooperativeProfile(
  data: IUpdateSupplierProfileInput,
): Promise<MarketplaceSupplierProfileView> {
  const { [Mutations.Marketplace.UpdateCooperativeProfile.name]: profile } = await client.Mutation(
    Mutations.Marketplace.UpdateCooperativeProfile.mutation,
    { variables: { data } },
  );
  return profile;
}
