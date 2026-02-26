import type { IssuePriority } from '../enums/issue-priority.enum';
import type { IssueStatus } from '../enums/issue-status.enum';
import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';

/**
 * Интерфейс данных задачи из базы данных
 */
export interface IIssueDatabaseData extends IBaseDatabaseData {
  id: string; // Уникальный ID задачи в формате PREFIX-N (например, ABC-1)
  issue_hash: string; // Хеш задачи для внешних ссылок
  coopname: string; // Имя аккаунта кооператива
  title: string; // Название задачи
  description?: string; // Описание задачи
  priority: IssuePriority; // Приоритет задачи
  status: IssueStatus; // Статус задачи
  estimate: number; // Оценка в story points или часах
  sort_order: number; // Порядок сортировки
  created_by: string; // Имя пользователя, создавшего задачу
  creators: string[]; // Массив имен пользователей создателей (contributors)
  submaster?: string; // Имя пользователя ответственного (contributor)
  project_hash: string; // Хеш проекта
  cycle_id?: string; // ID цикла
  metadata: {
    labels: string[];
    attachments: string[];
  }; // Метаданные задачи
}
