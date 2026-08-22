import type { Queries } from '@coopenomics/sdk';
import type { NotificationCategory } from 'src/shared/ui/domain/NotificationCenter';

export type IInboxPage =
  Queries.Notification.GetInboxNotifications.IOutput[typeof Queries.Notification.GetInboxNotifications.name];

export type IInboxNotification = IInboxPage['items'][number];

export type IInboxPagination = Queries.Notification.GetInboxNotifications.IInput['pagination'];

export interface ILoadInboxInput {
  coopname: string;
  pagination: IInboxPagination;
}

/**
 * Категория уведомления для группировки в доменном NotificationCenter
 * выводится из `workflowId` по ключевым словам. Каталог уведомлений
 * (@coopenomics/notifications) не несёт UI-категории — это деривация фронта,
 * а не поле бэкенда.
 */
export function categoryFromWorkflowId(workflowId: string): NotificationCategory {
  const id = workflowId.toLowerCase();
  if (/(payment|deposit|withdraw|transfer|wallet|invest|return)/.test(id)) return 'financial';
  if (/(meet|decision|agenda|approval|vote|soviet)/.test(id)) return 'voting';
  if (/(chat|calendar|message|comment)/.test(id)) return 'message';
  return 'system';
}
