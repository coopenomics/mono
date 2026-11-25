import { client } from 'src/shared/api/client';
import { Queries, Mutations } from '@coopenomics/sdk';
import type {
  IJournalPage,
  INotificationDetail,
  ILoadNotificationsInput,
  IResendOutput,
} from '../model/types';

/** Журнал уведомлений кооператива (стол председателя): фильтры + пагинация. */
async function loadNotifications(data: ILoadNotificationsInput): Promise<IJournalPage> {
  const { [Queries.Notification.GetNotifications.name]: output } = await client.Query(
    Queries.Notification.GetNotifications.query,
    { variables: { filter: data.filter, pagination: data.pagination } }
  );
  return output;
}

/** Уведомление целиком: тема, текст и попытки доставки. */
async function loadNotification(id: string): Promise<INotificationDetail> {
  const { [Queries.Notification.GetNotification.name]: output } = await client.Query(
    Queries.Notification.GetNotification.query,
    { variables: { id } }
  );
  return output;
}

/** Переотправить уведомление (постановка новой строки в очередь доставки). */
async function resendNotification(id: string): Promise<IResendOutput> {
  const { [Mutations.Notification.ResendNotification.name]: output } = await client.Mutation(
    Mutations.Notification.ResendNotification.mutation,
    { variables: { id } }
  );
  return output;
}

export const api = {
  loadNotifications,
  loadNotification,
  resendNotification,
};
