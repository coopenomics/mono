import type { ICommentDatabaseData } from '../interfaces/comment-database.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';

/**
 * Доменная сущность комментария
 *
 * Представляет комментарий к задаче
 */
export class CommentDomainEntity extends BaseDomainEntity<ICommentDatabaseData> {
  // Специфичные поля для комментария
  public content: string; // Содержимое комментария
  public commentor_id: string; // ID комментатора (contributor)
  public issue_id: string; // ID задачи
  public reactions: Record<string, string[]>; // Реакции на комментарий
  public edited_at?: Date; // Дата редактирования

  /**
   * Конструктор для создания доменной сущности
   *
   * @param databaseData - данные из базы данных
   */
  constructor(databaseData: ICommentDatabaseData) {
    // Вызываем конструктор базового класса
    super(databaseData);

    // Устанавливаем специфичные поля комментария
    this.content = databaseData.content;
    this.commentor_id = databaseData.commentor_id;
    this.issue_id = databaseData.issue_id;
    this.reactions = databaseData.reactions;
    this.edited_at = databaseData.edited_at;
  }
}
