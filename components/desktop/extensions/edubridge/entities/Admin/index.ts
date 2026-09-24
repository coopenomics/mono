import { Mutations, Queries, Zeus } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { t } from '../../i18n';

export type IMemberRow = Queries.Edubridge.Members.IOutput['edubridgeMembers'][number];
export type IMemberCard = Queries.Edubridge.MemberCard.IOutput['edubridgeMemberCard'];
export type IAccessTask = Queries.Edubridge.Queue.IOutput['edubridgeQueue'][number];
export type IConnector = Queries.Edubridge.Connectors.IOutput['edubridgeConnectors'][number];
export type IAdmin = Queries.Edubridge.Admins.IOutput['edubridgeAdmins'][number];
export type IAttention = Queries.Edubridge.Attention.IOutput['edubridgeAttention'];

// Ключи — имена enum'ов схемы (`Zeus.*`): именно их отдаёт и принимает GraphQL.
export const TASK_STATUS_LABELS: Record<string, { label: string; variant: 'pos' | 'neg' | 'warn' | 'info' | 'neutral' }> = {
  [Zeus.EduAccessTaskStatus.PENDING]: { label: t('edubridge.accessTask.status.PENDING'), variant: 'info' },
  [Zeus.EduAccessTaskStatus.RUNNING]: { label: t('edubridge.accessTask.status.RUNNING'), variant: 'info' },
  [Zeus.EduAccessTaskStatus.DONE]: { label: t('edubridge.accessTask.status.DONE'), variant: 'pos' },
  [Zeus.EduAccessTaskStatus.FAILED]: { label: t('edubridge.accessTask.status.FAILED'), variant: 'neg' },
  [Zeus.EduAccessTaskStatus.NEEDS_ATTENTION]: { label: t('edubridge.accessTask.status.NEEDS_ATTENTION'), variant: 'warn' },
};
export const TASK_KIND_LABELS: Record<string, string> = {
  [Zeus.EduAccessTaskKind.GRANT]: t('edubridge.accessTask.kind.GRANT'),
  [Zeus.EduAccessTaskKind.REVOKE]: t('edubridge.accessTask.kind.REVOKE'),
};
export const HEALTH_LABELS: Record<string, { label: string; variant: 'pos' | 'neg' | 'warn' | 'neutral' }> = {
  [Zeus.EduConnectorHealth.UNKNOWN]: { label: t('edubridge.connector.health.UNKNOWN'), variant: 'neutral' },
  [Zeus.EduConnectorHealth.OK]: { label: t('edubridge.connector.health.OK'), variant: 'pos' },
  [Zeus.EduConnectorHealth.FAILING]: { label: t('edubridge.connector.health.FAILING'), variant: 'neg' },
  [Zeus.EduConnectorHealth.LICENSE_LIMIT]: { label: t('edubridge.connector.health.LICENSE_LIMIT'), variant: 'warn' },
};

async function q<T>(query: any, name: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await client.Query(query, variables ? { variables } : undefined);
  return (res as Record<string, T>)[name] as T;
}
async function m<T>(mutation: any, name: string, variables: Record<string, unknown>): Promise<T> {
  const res = await client.Mutation(mutation, { variables });
  return (res as Record<string, T>)[name] as T;
}

/** Сколько дел ждёт администратора — числа на пунктах меню. */
export const fetchAttention = () => q<IAttention>(Queries.Edubridge.Attention.query, Queries.Edubridge.Attention.name);

// Оба пункта меню берут числа из одной сводки: запросы в пределах пары секунд
// делят один ответ, а не спрашивают сервер дважды.
const ATTENTION_REUSE_MS = 2000;
let attentionCache: { at: number; value: Promise<IAttention> } | null = null;
export function sharedAttention(): Promise<IAttention> {
  if (!attentionCache || Date.now() - attentionCache.at > ATTENTION_REUSE_MS) {
    attentionCache = { at: Date.now(), value: fetchAttention() };
  }
  return attentionCache.value;
}

/** Сводка изменилась (сигнал ленты) — следующий запрос идёт на сервер. */
export function invalidateAttention(): void {
  attentionCache = null;
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
export const setConnectorCredentials = (carrier: string, values: Array<{ key: string; value: string }>) =>
  m<IConnector>(Mutations.Edubridge.SetConnectorCredentials.mutation, Mutations.Edubridge.SetConnectorCredentials.name, { data: { carrier, values } });
export const appointAdmin = (username: string) => m<IAdmin>(Mutations.Edubridge.AppointAdmin.mutation, Mutations.Edubridge.AppointAdmin.name, { data: { username } });
export const dismissAdmin = (username: string) => m<boolean>(Mutations.Edubridge.DismissAdmin.mutation, Mutations.Edubridge.DismissAdmin.name, { data: { username } });
