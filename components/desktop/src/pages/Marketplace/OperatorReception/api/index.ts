import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { MarketplaceAplReceptionView } from '../../OffererPendingAplReceptions/api';

export type { MarketplaceAplReceptionView } from '../../OffererPendingAplReceptions/api';

export async function listAplReceptionsByKu(ku_id: string): Promise<MarketplaceAplReceptionView[]> {
  const result = await client.Query(Queries.Marketplace.ListAplReceptionsByKu.query, {
    variables: { ku_id },
  });
  return result[
    Queries.Marketplace.ListAplReceptionsByKu.name
  ] as unknown as MarketplaceAplReceptionView[];
}

export interface CreateAplReceptionVariables {
  shipment_id: string;
  fact_quantity_per_order?: Array<{ order_id: string; fact_quantity: number }>;
}

export async function createAplReception(
  variables: CreateAplReceptionVariables,
): Promise<{ apl_reception: MarketplaceAplReceptionView }> {
  const result = await client.Mutation(Mutations.Marketplace.CreateAplReception.mutation, {
    variables: { input: variables },
  });
  return result[Mutations.Marketplace.CreateAplReception.name] as unknown as {
    apl_reception: MarketplaceAplReceptionView;
  };
}

export async function signAsChairman(
  apl_reception_id: string,
): Promise<{ apl_reception: MarketplaceAplReceptionView }> {
  const result = await client.Mutation(Mutations.Marketplace.SignAplReceptionAsChairman.mutation, {
    variables: { input: { apl_reception_id } },
  });
  return result[Mutations.Marketplace.SignAplReceptionAsChairman.name] as unknown as {
    apl_reception: MarketplaceAplReceptionView;
  };
}
