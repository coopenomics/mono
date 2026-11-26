// 487-31: цены пакетов кооператива-издателя в каталоге приложений.
import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';

export type IPackagePricing = Queries.Extensions.AppsPackagePricing.IOutput[
  typeof Queries.Extensions.AppsPackagePricing.name
][number];
export type ISetPackagePricingInput = Mutations.Extensions.SetAppsPackagePricing.IInput['data'];

async function listPricing(): Promise<IPackagePricing[]> {
  const { [Queries.Extensions.AppsPackagePricing.name]: output } = await client.Query(
    Queries.Extensions.AppsPackagePricing.query,
    { variables: {} },
  );
  return output;
}

async function setPricing(data: ISetPackagePricingInput): Promise<IPackagePricing> {
  const { [Mutations.Extensions.SetAppsPackagePricing.name]: output } = await client.Mutation(
    Mutations.Extensions.SetAppsPackagePricing.mutation,
    { variables: { data } },
  );
  return output;
}

export const api = { listPricing, setPricing };
