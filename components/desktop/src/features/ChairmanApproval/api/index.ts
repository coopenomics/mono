import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';

/**
 * Одобрения председателя — документы на его вторую подпись. Список ведёт стол
 * председателя, но подписать можно и там, где процесс начался (карточка
 * преподавателя и т. п.): одобрение одно, решение по нему закрывает его везде.
 */
export type IChairmanApproval = Queries.Chairman.GetApprovals.IOutput[typeof Queries.Chairman.GetApprovals.name]['items'][number];
export type IConfirmApprovalInput = Mutations.Chairman.ConfirmApprove.IInput['data'];
export type IConfirmApprovalOutput = Mutations.Chairman.ConfirmApprove.IOutput[typeof Mutations.Chairman.ConfirmApprove.name];
export type IDeclineApprovalInput = Mutations.Chairman.DeclineApprove.IInput['data'];
export type IDeclineApprovalOutput = Mutations.Chairman.DeclineApprove.IOutput[typeof Mutations.Chairman.DeclineApprove.name];

/** Одобрение целиком (с документом на подпись) по его хэшу. */
export async function findApprovalByHash(coopname: string, approval_hash: string): Promise<IChairmanApproval | null> {
  const { [Queries.Chairman.GetApprovals.name]: page } = await client.Query(Queries.Chairman.GetApprovals.query, {
    variables: { filter: { coopname, approval_hash: approval_hash.toLowerCase() }, options: { page: 1, limit: 1 } },
  });
  return page.items[0] ?? null;
}

export async function confirmApproval(data: IConfirmApprovalInput): Promise<IConfirmApprovalOutput> {
  const { [Mutations.Chairman.ConfirmApprove.name]: result } = await client.Mutation(Mutations.Chairman.ConfirmApprove.mutation, {
    variables: { data },
  });
  return result;
}

export async function declineApproval(data: IDeclineApprovalInput): Promise<IDeclineApprovalOutput> {
  const { [Mutations.Chairman.DeclineApprove.name]: result } = await client.Mutation(Mutations.Chairman.DeclineApprove.mutation, {
    variables: { data },
  });
  return result;
}
