import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type MarketplaceShipmentView =
  Queries.Marketplace.ListShipments.IOutput['marketplaceListShipments'][number];

export type MarketplaceShipmentTTNDataView = NonNullable<MarketplaceShipmentView['ttn_data']>;

export async function listShipments(cycle_id?: string): Promise<MarketplaceShipmentView[]> {
  const { [Queries.Marketplace.ListShipments.name]: result } = await client.Query(
    Queries.Marketplace.ListShipments.query,
    { variables: { data: { cycle_id } } },
  );
  return result;
}

export type CreateShipmentVariables = Mutations.Marketplace.CreateShipment.IInput['data'];

export async function createShipment(
  data: CreateShipmentVariables,
): Promise<Mutations.Marketplace.CreateShipment.IOutput['marketplaceCreateShipment']> {
  const { [Mutations.Marketplace.CreateShipment.name]: result } = await client.Mutation(
    Mutations.Marketplace.CreateShipment.mutation,
    { variables: { data } },
  );
  return result;
}
