import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { SignedDocumentInput } from '../../OffererPendingAplReceptions/api';

export type { SignedDocumentInput } from '../../OffererPendingAplReceptions/api';

export interface MarketplaceOrderIssuanceFactView {
  actual_quantity: number;
  fact_cost: string;
  diff_state: 'equal' | 'less' | 'more';
}

export interface MarketplaceOrderIssuanceView {
  id: string;
  coopname: string;
  order_hash: string;
  orderer_account: string;
  supplier_account: string;
  delivery_braname: string;
  quantity: number;
  price_per_unit: string;
  total_cost: string;
  warranty_period_secs: number;
  warranty_until: string | null;
  status: string;
  current_warehouse_braname: string | null;
  issuance_fact: MarketplaceOrderIssuanceFactView | null;
  chairman_signed_at: string | null;
  chairman_account: string | null;
  signiss1_tx_hash: string | null;
  orderer_signed_at: string | null;
  delivery_signer_account: string | null;
  signiss2_tx_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceIssuanceResultView {
  order: MarketplaceOrderIssuanceView;
  tx_hash: string;
}

export interface MarketplaceGeneratedDocumentView {
  full_title: string;
  html: string;
  hash: string;
  meta: Record<string, unknown>;
  binary: string | null;
}

export async function listIssuancesByBraname(
  delivery_braname: string,
): Promise<MarketplaceOrderIssuanceView[]> {
  const result = await client.Query(Queries.Marketplace.ListIssuancesByBraname.query, {
    variables: { data: { delivery_braname } },
  });
  return result[
    Queries.Marketplace.ListIssuancesByBraname.name
  ] as unknown as MarketplaceOrderIssuanceView[];
}

export async function listMyReadyToReceive(): Promise<MarketplaceOrderIssuanceView[]> {
  const result = await client.Query(Queries.Marketplace.ListMyReadyToReceive.query, {});
  return result[
    Queries.Marketplace.ListMyReadyToReceive.name
  ] as unknown as MarketplaceOrderIssuanceView[];
}

export async function getChairmanSignablePayload(
  order_id: string,
): Promise<MarketplaceGeneratedDocumentView> {
  const result = await client.Query(Queries.Marketplace.IssueActChairmanSignablePayload.query, {
    variables: { data: { order_id } },
  });
  return result[
    Queries.Marketplace.IssueActChairmanSignablePayload.name
  ] as unknown as MarketplaceGeneratedDocumentView;
}

export async function getOrdererSignablePayload(
  order_id: string,
  actual_quantity?: number,
): Promise<MarketplaceGeneratedDocumentView> {
  const result = await client.Query(Queries.Marketplace.IssueActOrdererSignablePayload.query, {
    variables: { data: { order_id, actual_quantity } },
  });
  return result[
    Queries.Marketplace.IssueActOrdererSignablePayload.name
  ] as unknown as MarketplaceGeneratedDocumentView;
}

export async function openIssuance(
  order_id: string,
  signed_document: SignedDocumentInput,
): Promise<MarketplaceIssuanceResultView> {
  const result = await client.Mutation(Mutations.Marketplace.OpenIssuance.mutation, {
    variables: { data: { order_id, signed_document } },
  });
  return result[
    Mutations.Marketplace.OpenIssuance.name
  ] as unknown as MarketplaceIssuanceResultView;
}

export async function finalizeIssuance(
  order_id: string,
  actual_quantity: number,
  delivery_signer: string,
  signed_document: SignedDocumentInput,
): Promise<MarketplaceIssuanceResultView> {
  const result = await client.Mutation(Mutations.Marketplace.FinalizeIssuance.mutation, {
    variables: { data: { order_id, actual_quantity, delivery_signer, signed_document } },
  });
  return result[
    Mutations.Marketplace.FinalizeIssuance.name
  ] as unknown as MarketplaceIssuanceResultView;
}
