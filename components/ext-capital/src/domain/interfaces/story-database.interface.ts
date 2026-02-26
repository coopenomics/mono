import type { StoryStatus } from '../enums/story-status.enum';
import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';

/**
 * Интерфейс данных истории из базы данных
 */
export interface IStoryDatabaseData extends IBaseDatabaseData {
  story_hash: string; // Хеш истории для внешних ссылок
  coopname: string; // Имя аккаунта кооператива
  title: string; // Название истории
  description?: string; // Описание истории
  status: StoryStatus; // Статус истории
  project_hash?: string; // Хеш проекта (если история привязана к проекту)
  issue_hash?: string; // Хеш задачи (если история привязана к задаче)
  created_by: string; // Имя пользователя, создавшего историю
  sort_order: number; // Порядок сортировки
}
