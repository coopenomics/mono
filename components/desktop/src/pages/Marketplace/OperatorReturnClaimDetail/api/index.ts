import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { MarketplaceReturnClaimView } from '../../OperatorReturnClaims/api';

export async function fetchReturnClaim(claim_id: string): Promise<MarketplaceReturnClaimView> {
  const { [Queries.Marketplace.ReturnClaim.name]: result } = await client.Query(
    Queries.Marketplace.ReturnClaim.query,
    { variables: { claim_id } },
  );
  return result as MarketplaceReturnClaimView;
}
