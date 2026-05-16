import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { MarketplaceAplReceptionView, SignedDocumentInput } from '../../OffererPendingAplReceptions/api';

export type { MarketplaceAplReceptionView } from '../../OffererPendingAplReceptions/api';

export async function listAplReceptionsByBraname(braname: string): Promise<MarketplaceAplReceptionView[]> {
  const result = await client.Query(Queries.Marketplace.ListAplReceptionsByBraname.query, {
    variables: { data: { braname } },
  });
  return result[
    Queries.Marketplace.ListAplReceptionsByBraname.name
  ] as unknown as MarketplaceAplReceptionView[];
}

export interface CreateAplReceptionVariables {
  shipment_id: string;
  fact_quantity_per_order?: Array<{ order_id: string; fact_quantity: number }>;
}

export async function createAplReception(
  data: CreateAplReceptionVariables,
): Promise<{ apl_reception: MarketplaceAplReceptionView }> {
  const result = await client.Mutation(Mutations.Marketplace.CreateAplReception.mutation, {
    variables: { data },
  });
  return result[Mutations.Marketplace.CreateAplReception.name] as unknown as {
    apl_reception: MarketplaceAplReceptionView;
  };
}

export async function signAsChairman(
  apl_reception_id: string,
  signed_documents: SignedDocumentInput[],
): Promise<{ apl_reception: MarketplaceAplReceptionView }> {
  const result = await client.Mutation(Mutations.Marketplace.SignAplReceptionAsChairman.mutation, {
    variables: { data: { apl_reception_id, signed_documents } },
  });
  return result[Mutations.Marketplace.SignAplReceptionAsChairman.name] as unknown as {
    apl_reception: MarketplaceAplReceptionView;
  };
}
