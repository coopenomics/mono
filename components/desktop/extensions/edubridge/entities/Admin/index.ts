import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type IMemberRow = Queries.Edubridge.Members.IOutput['edubridgeMembers'][number];
export type IMemberCard = Queries.Edubridge.MemberCard.IOutput['edubridgeMemberCard'];
export type IAccessTask = Queries.Edubridge.Queue.IOutput['edubridgeQueue'][number];
export type IConnector = Queries.Edubridge.Connectors.IOutput['edubridgeConnectors'][number];
export type IAdmin = Queries.Edubridge.Admins.IOutput['edubridgeAdmins'][number];

export const TASK_STATUS_LABELS: Record<string, { label: string; variant: 'pos' | 'neg' | 'warn' | 'info' | 'neutral' }> = {
  pending: { label: 'В очереди', variant: 'info' },
  running: { label: 'Выполняется', variant: 'info' },
  done: { label: 'Выполнена', variant: 'pos' },
  failed: { label: 'Ошибка', variant: 'neg' },
  needs_attention: { label: 'Требует вмешательства', variant: 'warn' },
};
export const TASK_KIND_LABELS: Record<string, string> = { grant: 'Выдача', revoke: 'Отзыв' };
export const HEALTH_LABELS: Record<string, { label: string; variant: 'pos' | 'neg' | 'warn' | 'neutral' }> = {
  unknown: { label: 'Не проверялась', variant: 'neutral' },
  ok: { label: 'Работает', variant: 'pos' },
  failing: { label: 'Сбоит', variant: 'neg' },
  license_limit: { label: 'Лимит лицензии', variant: 'warn' },
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
export const fetchQueue = (statuses?: string[]) => q<IAccessTask[]>(Queries.Edubridge.Queue.query, Queries.Edubridge.Queue.name, { filter: statuses?.length ? { statuses } : undefined });
export const fetchConnectors = () => q<IConnector[]>(Queries.Edubridge.Connectors.query, Queries.Edubridge.Connectors.name);
export const fetchAdmins = () => q<IAdmin[]>(Queries.Edubridge.Admins.query, Queries.Edubridge.Admins.name);
export const retryTask = (task_id: string) => m<IAccessTask>(Mutations.Edubridge.RetryTask.mutation, Mutations.Edubridge.RetryTask.name, { data: { task_id } });
export const checkConnector = (carrier: string) => m<IConnector>(Mutations.Edubridge.CheckConnector.mutation, Mutations.Edubridge.CheckConnector.name, { carrier });
export const setConnectorEnabled = (carrier: string, enabled: boolean) =>
  m<IConnector>(Mutations.Edubridge.SetConnectorEnabled.mutation, Mutations.Edubridge.SetConnectorEnabled.name, { data: { carrier, enabled } });
export const appointAdmin = (username: string) => m<IAdmin>(Mutations.Edubridge.AppointAdmin.mutation, Mutations.Edubridge.AppointAdmin.name, { data: { username } });
export const dismissAdmin = (username: string) => m<boolean>(Mutations.Edubridge.DismissAdmin.mutation, Mutations.Edubridge.DismissAdmin.name, { data: { username } });
