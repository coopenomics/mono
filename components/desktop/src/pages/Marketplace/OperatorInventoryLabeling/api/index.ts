import { Mutations, Queries, Zeus } from '@coopenomics/sdk'
import { client } from 'src/shared/api/client'

export interface MarketplaceOrderForLabeling {
  id: string;
  quantity: number;
  offer_id: string;
  orderer_account: string;
  delivery_braname: string;
  status: string;
}

// Zeus маппит скаляр ID в `unknown`; идентификатор переопределяем на строку
// (используется как :key и для slice в UI).
type _RawInventoryItem =
  Queries.Marketplace.ListInventory.IOutput['marketplaceListInventory'][number];
export type MarketplaceInventoryItemView = Omit<_RawInventoryItem, 'id'> & { id: string };

type _RawShipment =
  Queries.Marketplace.ListShipments.IOutput['marketplaceListShipments'][number];
export type MarketplaceShipmentView = Omit<_RawShipment, 'id'> & { id: string };

export type MarketplaceLabelShipmentInventoryResultView =
  Mutations.Marketplace.LabelShipmentInventory.IOutput['marketplaceLabelShipmentInventory'];

export async function fetchInventoryByBraname(braname: string): Promise<MarketplaceInventoryItemView[]> {
  const { [Queries.Marketplace.ListInventory.name]: result } = await client.Query(
    Queries.Marketplace.ListInventory.query,
    { variables: { data: { braname } } },
  )
  // Zeus отдаёт ID как unknown; сужаем идентификатор до строки во view-типе.
  return result as MarketplaceInventoryItemView[]
}

const SHIPMENT_STATUSES_FOR_LABELING: Zeus.MarketplaceShipmentStatus[] = [
  Zeus.MarketplaceShipmentStatus.SUPPLY_PREPARED,
  Zeus.MarketplaceShipmentStatus.RECEPTION_IN_PROGRESS,
]

export async function fetchShipmentsForLabeling(braname?: string): Promise<MarketplaceShipmentView[]> {
  const data: Queries.Marketplace.ListShipments.IInput['data'] = {
    statuses: SHIPMENT_STATUSES_FOR_LABELING,
  }
  if (braname) data.braname = braname
  const { [Queries.Marketplace.ListShipments.name]: result } = await client.Query(
    Queries.Marketplace.ListShipments.query,
    { variables: { data } },
  )
  // Zeus отдаёт ID как unknown; сужаем идентификатор до строки во view-типе.
  return result as MarketplaceShipmentView[]
}

export async function labelInventory(
  data: Mutations.Marketplace.LabelInventory.IInput['data'],
): Promise<Mutations.Marketplace.LabelInventory.IOutput['marketplaceLabelInventory']> {
  const { [Mutations.Marketplace.LabelInventory.name]: result } = await client.Mutation(
    Mutations.Marketplace.LabelInventory.mutation,
    { variables: { data } },
  )
  return result
}

export async function labelShipmentInventory(
  data: Mutations.Marketplace.LabelShipmentInventory.IInput['data'],
): Promise<MarketplaceLabelShipmentInventoryResultView> {
  const { [Mutations.Marketplace.LabelShipmentInventory.name]: result } = await client.Mutation(
    Mutations.Marketplace.LabelShipmentInventory.mutation,
    { variables: { data } },
  )
  return result
}
