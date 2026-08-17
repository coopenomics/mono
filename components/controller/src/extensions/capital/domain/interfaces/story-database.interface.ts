import type { StoryStatus } from '../enums/story-status.enum';
import type { StoryContentFormat } from '../enums/story-content-format.enum';
import type { IBaseDatabaseData } from '@coopenomics/extension-kit/sync';

/** Событие Matrix: анонс требования в комнате проекта (для правки заголовка через m.replace). */
export interface IStoryMatrixRequirementAnnouncementEvent {
  matrix_room_id: string;
  event_id: string;
}

/**
 * Интерфейс данных истории из базы данных
 */
export interface IStoryDatabaseData extends IBaseDatabaseData {
  story_hash: string; // Хеш истории для внешних ссылок
  coopname: string; // Имя аккаунта кооператива
  title: string; // Название истории
  description?: string; // Описание истории
  content_format: StoryContentFormat; // Формат тела: MARKDOWN, BPMN XML, DRAWIO XML, MERMAID
  status: StoryStatus; // Статус истории
  project_hash?: string; // Хеш проекта (если история привязана к проекту)
  issue_hash?: string; // Хеш задачи (если история привязана к задаче)
  created_by: string; // Имя пользователя, создавшего историю
  sort_order: number; // Порядок сортировки
  /** Публикации анонса требования в Matrix по комнатам (после успешной отправки). */
  matrix_requirement_announcement_events?: IStoryMatrixRequirementAnnouncementEvent[];
}
