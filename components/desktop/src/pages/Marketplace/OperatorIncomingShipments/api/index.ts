import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type MarketplaceShipmentView =
  Queries.Marketplace.ListShipmentsByBraname.IOutput['marketplaceListShipmentsByBraname'][number];

export type IListShipmentsByBranameInput =
  Queries.Marketplace.ListShipmentsByBraname.IInput['data'];

export async function listShipmentsByBraname(
  data: IListShipmentsByBranameInput,
): Promise<MarketplaceShipmentView[]> {
  const { [Queries.Marketplace.ListShipmentsByBraname.name]: result } = await client.Query(
    Queries.Marketplace.ListShipmentsByBraname.query,
    { variables: { data } },
  );
  return result;
}
