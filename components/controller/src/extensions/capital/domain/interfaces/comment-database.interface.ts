import type { IBaseDatabaseData } from '@coopenomics/extension-kit/sync';

/**
 * Интерфейс данных комментария из базы данных
 */
export interface ICommentDatabaseData extends IBaseDatabaseData {
  content: string; // Содержимое комментария
  commentor_id: string; // ID комментатора (contributor)
  issue_id: string; // ID задачи
  reactions: Record<string, string[]>; // Реакции на комментарий
  edited_at?: Date; // Дата редактирования
}
