import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type MarketplaceCurrentMemberView =
  Queries.Marketplace.WhoAmI.IOutput['marketplaceWhoAmI'];

export async function fetchWhoAmI(): Promise<MarketplaceCurrentMemberView> {
  const { [Queries.Marketplace.WhoAmI.name]: result } = await client.Query(
    Queries.Marketplace.WhoAmI.query,
    { variables: {} },
  );
  return result;
}
