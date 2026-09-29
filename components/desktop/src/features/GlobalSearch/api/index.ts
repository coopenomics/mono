import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { IGlobalSearchGroup, IGlobalSearchInput } from '../model/types';

async function globalSearch(data: IGlobalSearchInput): Promise<IGlobalSearchGroup[]> {
  const { [Queries.Search.GlobalSearch.name]: output } = await client.Query(
    Queries.Search.GlobalSearch.query,
    { variables: { data } },
  );
  return output;
}

export const api = { globalSearch };
