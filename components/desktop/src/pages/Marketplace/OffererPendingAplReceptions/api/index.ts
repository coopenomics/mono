import { Mutations, Queries, type Types } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export interface MarketplaceAplReceptionView {
  id: string;
  coopname: string;
  shipment_id: string;
  cycle_id: string;
  braname: string;
  offerer_account: string;
  variant: 'A' | 'B';
  status: string;
  fact_quantity_per_order: Array<{ order_id: string; fact_quantity: number }>;
  ttn_number: string | null;
  total_amount: string;
  supplier_signed_at: string | null;
  chairman_signed_at: string | null;
}

export type SignedDocumentInput = Types.Document.ISignedDocumentInput;
export type MarketplaceAplReceptionDocumentView = Types.Document.IGeneratedDocument;

export async function listAplReceptionsAsSupplier(): Promise<MarketplaceAplReceptionView[]> {
  const result = await client.Query(Queries.Marketplace.ListAplReceptionsAsSupplier.query, {});
  return result[
    Queries.Marketplace.ListAplReceptionsAsSupplier.name
  ] as unknown as MarketplaceAplReceptionView[];
}

export async function fetchSupplierSignablePayloads(
  apl_reception_id: string,
): Promise<MarketplaceAplReceptionDocumentView[]> {
  const result = await client.Query(
    Queries.Marketplace.AplReceptionSupplierSignablePayloads.query,
    { variables: { data: { apl_reception_id } } },
  );
  return result[
    Queries.Marketplace.AplReceptionSupplierSignablePayloads.name
  ] as unknown as MarketplaceAplReceptionDocumentView[];
}

export async function signAsSupplier(
  apl_reception_id: string,
  signed_documents: SignedDocumentInput[],
): Promise<{ apl_reception: MarketplaceAplReceptionView }> {
  const result = await client.Mutation(Mutations.Marketplace.SignAplReceptionAsSupplier.mutation, {
    variables: { data: { apl_reception_id, signed_documents } },
  });
  return result[Mutations.Marketplace.SignAplReceptionAsSupplier.name] as unknown as {
    apl_reception: MarketplaceAplReceptionView;
  };
}
