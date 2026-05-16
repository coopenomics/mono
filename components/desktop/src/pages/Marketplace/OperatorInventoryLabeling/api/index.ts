import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

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

export async function fetchInventoryByBraname(braname: string): Promise<MarketplaceInventoryItemView[]> {
  const result = await client.Query(Queries.Marketplace.ListInventory.query, {
    variables: { data: { braname } },
  });
  return result[Queries.Marketplace.ListInventory.name] as unknown as MarketplaceInventoryItemView[];
}

export async function labelInventory(data: {
  order_id: string;
  strategy?: 'PER_ORDER' | 'PER_UNIT' | 'PER_PACKAGE';
  format?: 'CODE128' | 'EAN13';
  pack_size?: number;
}): Promise<{ inventory: MarketplaceInventoryItemView[] }> {
  const result = await client.Mutation(Mutations.Marketplace.LabelInventory.mutation, {
    variables: { data },
  });
  return result[Mutations.Marketplace.LabelInventory.name] as unknown as {
    inventory: MarketplaceInventoryItemView[];
  };
}
