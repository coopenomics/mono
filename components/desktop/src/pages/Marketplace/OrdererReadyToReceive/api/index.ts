import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type {
  MarketplaceOrderIssuanceView,
  MarketplaceOrderIssuanceFactView,
} from '../../OperatorIssuance/api';
import type { MarketplaceOrderIssuanceView } from '../../OperatorIssuance/api';

export async function listMyReadyToReceive(): Promise<MarketplaceOrderIssuanceView[]> {
  const result = await client.Query(Queries.Marketplace.ListMyReadyToReceive.query, {});
  return result[
    Queries.Marketplace.ListMyReadyToReceive.name
  ] as unknown as MarketplaceOrderIssuanceView[];
}
