import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export interface MarketplaceCurrentMemberView {
  username: string;
  core_roles: string[];
  marketplace_roles: string[];
  branches: string[];
}

export async function fetchWhoAmI(): Promise<MarketplaceCurrentMemberView> {
  const result = await client.Query(Queries.Marketplace.WhoAmI.query, { variables: {} });
  return result[Queries.Marketplace.WhoAmI.name] as unknown as MarketplaceCurrentMemberView;
}
