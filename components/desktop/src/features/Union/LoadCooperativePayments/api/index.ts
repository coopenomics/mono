import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type ICooperativePayment =
  Queries.System.GetCooperativePayments.IOutput['getCooperativePayments'][number];

/**
 * История оплат кооператива живёт в журнале биллинга хаба, а не в цепи:
 * контракт биллинга on-chain таблиц не ведёт, поэтому единственная летопись
 * списаний — этот журнал, и читается он через coopback.
 */
async function loadCooperativePayments(coopname: string, limit?: number): Promise<ICooperativePayment[]> {
  const { [Queries.System.GetCooperativePayments.name]: result } = await client.Query(
    Queries.System.GetCooperativePayments.query,
    { variables: { coopname, limit } },
  );

  return result;
}

export const api = {
  loadCooperativePayments,
};
