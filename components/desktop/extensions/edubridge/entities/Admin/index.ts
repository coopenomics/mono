import { Mutations, Queries, Zeus } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type IMemberRow = Queries.Edubridge.Members.IOutput['edubridgeMembers'][number];
export type IMemberCard = Queries.Edubridge.MemberCard.IOutput['edubridgeMemberCard'];
export type IAccessTask = Queries.Edubridge.Queue.IOutput['edubridgeQueue'][number];
export type IConnector = Queries.Edubridge.Connectors.IOutput['edubridgeConnectors'][number];
export type IAdmin = Queries.Edubridge.Admins.IOutput['edubridgeAdmins'][number];

// Ключи — имена enum'ов схемы (`Zeus.*`): именно их отдаёт и принимает GraphQL.
export const TASK_STATUS_LABELS: Record<string, { label: string; variant: 'pos' | 'neg' | 'warn' | 'info' | 'neutral' }> = {
  [Zeus.EduAccessTaskStatus.PENDING]: { label: 'В очереди', variant: 'info' },
  [Zeus.EduAccessTaskStatus.RUNNING]: { label: 'Выполняется', variant: 'info' },
  [Zeus.EduAccessTaskStatus.DONE]: { label: 'Выполнена', variant: 'pos' },
  [Zeus.EduAccessTaskStatus.FAILED]: { label: 'Ошибка', variant: 'neg' },
  [Zeus.EduAccessTaskStatus.NEEDS_ATTENTION]: { label: 'Требует вмешательства', variant: 'warn' },
};
export const TASK_KIND_LABELS: Record<string, string> = {
  [Zeus.EduAccessTaskKind.GRANT]: 'Выдача',
  [Zeus.EduAccessTaskKind.REVOKE]: 'Отзыв',
};
export const HEALTH_LABELS: Record<string, { label: string; variant: 'pos' | 'neg' | 'warn' | 'neutral' }> = {
  [Zeus.EduConnectorHealth.UNKNOWN]: { label: 'Не проверялась', variant: 'neutral' },
  [Zeus.EduConnectorHealth.OK]: { label: 'Работает', variant: 'pos' },
  [Zeus.EduConnectorHealth.FAILING]: { label: 'Сбоит', variant: 'neg' },
  [Zeus.EduConnectorHealth.LICENSE_LIMIT]: { label: 'Лимит лицензии', variant: 'warn' },
};

async function q<T>(query: any, name: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await client.Query(query, variables ? { variables } : undefined);
  return (res as Record<string, T>)[name] as T;
}
async function m<T>(mutation: any, name: string, variables: Record<string, unknown>): Promise<T> {
  const res = await client.Mutation(mutation, { variables });
  return (res as Record<string, T>)[name] as T;
}

export const fetchMembers = (search?: string) => q<IMemberRow[]>(Queries.Edubridge.Members.query, Queries.Edubridge.Members.name, { search });
export const fetchMemberCard = (username: string) => q<IMemberCard>(Queries.Edubridge.MemberCard.query, Queries.Edubridge.MemberCard.name, { username });
export const fetchQueue = (statuses?: Zeus.EduAccessTaskStatus[]) => q<IAccessTask[]>(Queries.Edubridge.Queue.query, Queries.Edubridge.Queue.name, { filter: statuses?.length ? { statuses } : undefined });
export const fetchConnectors = () => q<IConnector[]>(Queries.Edubridge.Connectors.query, Queries.Edubridge.Connectors.name);
export const fetchAdmins = () => q<IAdmin[]>(Queries.Edubridge.Admins.query, Queries.Edubridge.Admins.name);
export const retryTask = (task_id: string) => m<IAccessTask>(Mutations.Edubridge.RetryTask.mutation, Mutations.Edubridge.RetryTask.name, { data: { task_id } });
export const checkConnector = (carrier: string) => m<IConnector>(Mutations.Edubridge.CheckConnector.mutation, Mutations.Edubridge.CheckConnector.name, { carrier });
export const setConnectorEnabled = (carrier: string, enabled: boolean) =>
  m<IConnector>(Mutations.Edubridge.SetConnectorEnabled.mutation, Mutations.Edubridge.SetConnectorEnabled.name, { data: { carrier, enabled } });
export const appointAdmin = (username: string) => m<IAdmin>(Mutations.Edubridge.AppointAdmin.mutation, Mutations.Edubridge.AppointAdmin.name, { data: { username } });
export const dismissAdmin = (username: string) => m<boolean>(Mutations.Edubridge.DismissAdmin.mutation, Mutations.Edubridge.DismissAdmin.name, { data: { username } });
