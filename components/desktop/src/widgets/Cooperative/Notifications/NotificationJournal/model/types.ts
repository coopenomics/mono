import type { Queries, Mutations } from '@coopenomics/sdk';

export type IJournalPage =
  Queries.Notification.GetNotifications.IOutput[typeof Queries.Notification.GetNotifications.name];

export type INotification = IJournalPage['items'][number];

export type INotificationsFilter = Queries.Notification.GetNotifications.IInput['filter'];

export type IJournalPagination = Queries.Notification.GetNotifications.IInput['pagination'];

export type IResendOutput =
  Mutations.Notification.ResendNotification.IOutput[typeof Mutations.Notification.ResendNotification.name];

export interface ILoadNotificationsInput {
  filter: INotificationsFilter;
  pagination: IJournalPagination;
}
