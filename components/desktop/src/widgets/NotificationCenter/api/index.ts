import { client } from 'src/shared/api/client';
import { Queries, Mutations } from '@coopenomics/sdk';
import type {
  IInboxNotification,
  ILoadInboxInput,
  IInboxPage,
} from '../model/types';

/** Лента личного инбокса текущего пользователя (получатель — из JWT на бэкенде). */
async function loadInbox(data: ILoadInboxInput): Promise<IInboxPage> {
  const { [Queries.Notification.GetInboxNotifications.name]: output } = await client.Query(
    Queries.Notification.GetInboxNotifications.query,
    { variables: { coopname: data.coopname, pagination: data.pagination } }
  );
  return output;
}

/** Число непрочитанных (бейдж колокола). */
async function loadUnreadCount(coopname: string): Promise<number> {
  const { [Queries.Notification.GetUnreadNotificationsCount.name]: output } = await client.Query(
    Queries.Notification.GetUnreadNotificationsCount.query,
    { variables: { coopname } }
  );
  return output.count;
}

/** Отметить одно уведомление прочитанным. */
async function markRead(id: string): Promise<IInboxNotification> {
  const { [Mutations.Notification.MarkNotificationRead.name]: output } = await client.Mutation(
    Mutations.Notification.MarkNotificationRead.mutation,
    { variables: { id } }
  );
  return output;
}

/** Отметить все прочитанными. Возвращает остаток непрочитанных (ожидаемо 0). */
async function markAllRead(coopname: string): Promise<number> {
  const { [Mutations.Notification.MarkAllNotificationsRead.name]: output } = await client.Mutation(
    Mutations.Notification.MarkAllNotificationsRead.mutation,
    { variables: { coopname } }
  );
  return output.count;
}

export const api = {
  loadInbox,
  loadUnreadCount,
  markRead,
  markAllRead,
};
