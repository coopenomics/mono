import { registerEnumType } from '@nestjs/graphql';
/**
 * Перечисление статусов задач
 */
export enum IssueStatus {
  BACKLOG = 'backlog', // В бэклоге
  TODO = 'todo', // К выполнению
  IN_PROGRESS = 'in_progress', // В работе
  ON_REVIEW = 'on_review', // На проверке
  DONE = 'done', // Выполнена
  CANCELED = 'canceled', // Отменена
}

registerEnumType(IssueStatus, {
  name: 'IssueStatus',
  description: 'Статус задачи в системе CAPITAL',
});
