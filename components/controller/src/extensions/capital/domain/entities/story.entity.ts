import { StoryStatus } from '../enums/story-status.enum';
import { StoryContentFormat } from '../enums/story-content-format.enum';
import type { IStoryDatabaseData, IStoryMatrixRequirementAnnouncementEvent } from '../interfaces/story-database.interface';
import { BaseDomainEntity } from '@coopenomics/extension-kit/sync';

/**
 * Доменная сущность истории (критерия выполнения)
 *
 * Представляет пользовательскую историю или критерий выполнения,
 * которая может быть привязана к проекту или задаче
 */
export class StoryDomainEntity extends BaseDomainEntity<IStoryDatabaseData> {
  // Специфичные поля для истории
  public story_hash: string; // Хеш истории для внешних ссылок
  public coopname: string; // Имя аккаунта кооператива
  public title: string; // Название истории
  public description?: string; // Описание истории
  public status: StoryStatus; // Статус истории (переопределяем тип)
  public project_hash?: string; // Хеш проекта (если история привязана к проекту)
  public issue_hash?: string; // Хеш задачи (если история привязана к задаче)
  public created_by: string; // Имя пользователя, создавшего историю
  public sort_order: number; // Порядок сортировки
  public content_rev: number; // Редакция содержимого
  public content_format: StoryContentFormat; // Формат содержимого истории
  public matrix_requirement_announcement_events?: IStoryMatrixRequirementAnnouncementEvent[];
  /**
   * Конструктор для создания доменной сущности
   *
   * @param databaseData - данные из базы данных
   */
  constructor(databaseData: IStoryDatabaseData) {
    // Вызываем конструктор базового класса
    super(databaseData, StoryStatus.PENDING);

    // Устанавливаем специфичные поля истории
    this.story_hash = databaseData.story_hash.toLowerCase();
    this.coopname = databaseData.coopname;
    this.title = databaseData.title;
    this.description = databaseData.description;
    this.content_format = databaseData.content_format ?? StoryContentFormat.MARKDOWN;
    this.status = databaseData.status; // Переопределяем статус с правильным типом
    this.project_hash = databaseData.project_hash?.toLowerCase();
    this.issue_hash = databaseData.issue_hash;
    this.created_by = databaseData.created_by;
    this.sort_order = databaseData.sort_order;
    this.content_rev = databaseData.content_rev ?? 0;
    this.matrix_requirement_announcement_events = databaseData.matrix_requirement_announcement_events;
  }
}
