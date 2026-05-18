import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type MarketplaceInventoryItemView =
  Queries.Marketplace.ListInventory.IOutput['marketplaceListInventory'][number];

export type IListInventoryInput = Queries.Marketplace.ListInventory.IInput['data'];

export async function listAllInventory(
  data?: IListInventoryInput,
): Promise<MarketplaceInventoryItemView[]> {
  const { [Queries.Marketplace.ListInventory.name]: result } = await client.Query(
    Queries.Marketplace.ListInventory.query,
    { variables: { data: data ?? {} } },
  );
  return result;
}
