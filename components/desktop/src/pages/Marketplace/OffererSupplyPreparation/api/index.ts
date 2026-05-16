import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export interface MarketplaceShipmentTTNDataView {
  expeditor_full_name: string;
  expeditor_id_doc: string;
  expeditor_phone: string;
  vehicle_number: string;
  loading_address: string;
  loading_datetime: string;
  delivery_datetime_estimate: string;
}

export interface MarketplaceShipmentView {
  id: string;
  coopname: string;
  cycle_id: string;
  braname: string;
  offerer_account: string;
  delivery_variant: 'A' | 'B';
  status: string;
  total_amount: string;
  ttn_number: string | null;
  ttn_data: MarketplaceShipmentTTNDataView | null;
  ttn_document_registry_id: string | null;
  ttn_pdf_url: string | null;
}

export async function listShipments(cycle_id?: string): Promise<MarketplaceShipmentView[]> {
  const result = await client.Query(Queries.Marketplace.ListShipments.query, {
    variables: { data: { cycle_id } },
  });
  return result[Queries.Marketplace.ListShipments.name] as unknown as MarketplaceShipmentView[];
}

export interface CreateShipmentVariables {
  cycle_id: string;
  groups: Array<{
    braname: string;
    delivery_variant: 'A' | 'B';
    order_ids: string[];
    ttn_data?: MarketplaceShipmentTTNDataView;
  }>;
}

export async function createShipment(
  data: CreateShipmentVariables,
): Promise<{ shipments: MarketplaceShipmentView[] }> {
  const result = await client.Mutation(Mutations.Marketplace.CreateShipment.mutation, {
    variables: { data },
  });
  return result[Mutations.Marketplace.CreateShipment.name] as unknown as {
    shipments: MarketplaceShipmentView[];
  };
}
