import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export async function fetchReturnBalance() {
  const { [Queries.Edubridge.ReturnBalance.name]: result } = await client.Query(Queries.Edubridge.ReturnBalance.query);
  return result;
}
