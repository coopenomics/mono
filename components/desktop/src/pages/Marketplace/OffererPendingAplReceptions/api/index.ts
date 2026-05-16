import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export interface MarketplaceAplReceptionView {
  id: string;
  coopname: string;
  shipment_id: string;
  cycle_id: string;
  ku_id: string;
  offerer_account: string;
  variant: 'A' | 'B';
  status: string;
  fact_quantity_per_order: Array<{ order_id: string; fact_quantity: number }>;
  ttn_number: string | null;
  total_amount: string;
  supplier_signed_at: string | null;
  chairman_signed_at: string | null;
}

export interface SignatureInfoView {
  id: number;
  signer: string;
  public_key: string;
  signature: string;
  signed_at: string;
  signed_hash: string;
  meta: string;
}

export interface SignedDocumentInput {
  version: string;
  hash: string;
  doc_hash: string;
  meta_hash: string;
  meta: Record<string, unknown>;
  signatures: SignatureInfoView[];
}

export interface MarketplaceAplReceptionDocumentView {
  full_title: string;
  html: string;
  hash: string;
  meta: Record<string, unknown>;
  binary: string;
}

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
    { variables: { apl_reception_id } },
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
    variables: { input: { apl_reception_id, signed_documents } },
  });
  return result[Mutations.Marketplace.SignAplReceptionAsSupplier.name] as unknown as {
    apl_reception: MarketplaceAplReceptionView;
  };
}
