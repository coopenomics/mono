import { Mutations, Queries } from '@coopenomics/sdk'
import { client } from 'src/shared/api/client'

export interface MarketplaceOrderForLabeling {
  id: string;
  quantity: number;
  offer_id: string;
  orderer_account: string;
  delivery_braname: string;
  status: string;
}

export interface MarketplaceInventoryItemView {
  id: string;
  barcode_value: string;
  barcode_format: 'CODE128' | 'EAN13';
  order_id: string;
  shipment_id: string;
  braname: string;
  status: 'LABELED' | 'ISSUED' | 'RETURNED' | 'WRITTEN_OFF';
  product_name_snapshot: string;
  quantity_per_label: number;
  orderer_account_snapshot: string;
  labeled_at: string;
}

export interface MarketplaceShipmentView {
  id: string;
  coopname: string;
  cycle_id: string;
  braname: string;
  offerer_account: string;
  delivery_variant: 'SELF_PICKUP' | 'EXPEDITOR' | string;
  status: string;
  total_amount: string;
  ttn_number: string | null;
  created_at: string;
}

export interface MarketplaceLabelShipmentInventoryResultView {
  inventory: MarketplaceInventoryItemView[];
  labeled_order_ids: string[];
  skipped_order_ids: string[];
}

export async function fetchInventoryByBraname(braname: string): Promise<MarketplaceInventoryItemView[]> {
  const result = await client.Query(Queries.Marketplace.ListInventory.query, {
    variables: { data: { braname } },
  })
  return result[Queries.Marketplace.ListInventory.name] as unknown as MarketplaceInventoryItemView[]
}

const SHIPMENT_STATUSES_FOR_LABELING = new Set(['SUPPLY_PREPARED', 'RECEPTION_IN_PROGRESS'])

export async function fetchShipmentsForLabeling(braname?: string): Promise<MarketplaceShipmentView[]> {
  const data: Queries.Marketplace.ListShipments.IInput['data'] = {}
  if (braname) data.braname = braname
  const result = await client.Query(Queries.Marketplace.ListShipments.query, {
    variables: { data },
  })
  const shipments = result[Queries.Marketplace.ListShipments.name] as unknown as MarketplaceShipmentView[]
  return shipments.filter((s) => SHIPMENT_STATUSES_FOR_LABELING.has(s.status))
}

export async function labelInventory(data: Mutations.Marketplace.LabelInventory.IInput['data']): Promise<{ inventory: MarketplaceInventoryItemView[] }> {
  const result = await client.Mutation(Mutations.Marketplace.LabelInventory.mutation, {
    variables: { data },
  })
  return result[Mutations.Marketplace.LabelInventory.name] as unknown as {
    inventory: MarketplaceInventoryItemView[];
  }
}

export async function labelShipmentInventory(
  data: Mutations.Marketplace.LabelShipmentInventory.IInput['data'],
): Promise<MarketplaceLabelShipmentInventoryResultView> {
  const result = await client.Mutation(Mutations.Marketplace.LabelShipmentInventory.mutation, {
    variables: { data },
  })
  return result[Mutations.Marketplace.LabelShipmentInventory.name] as unknown as MarketplaceLabelShipmentInventoryResultView
}
