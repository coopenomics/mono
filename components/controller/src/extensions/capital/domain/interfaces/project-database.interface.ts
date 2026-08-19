import type { IBaseDatabaseData } from '@coopenomics/extension-kit/sync';

/** Публикация анонса компонента в Matrix (комната родительского проекта), как у требований. */
export interface IProjectMatrixComponentAnnouncementEvent {
  matrix_room_id: string;
  event_id: string;
}

/**
 * Интерфейс данных проекта из базы данных
 */
export type IProjectDomainInterfaceDatabaseData = IBaseDatabaseData & {
  project_hash: string;
  blockchain_status?: string;
  prefix: string; // Префикс проекта из первых 3 символов project_hash в верхнем регистре
  issue_counter: number; // Счетчик для генерации последовательных ID задач
  voting_deadline: Date | null; // Денормализованное поле для быстрого поиска проектов с голосованиями (null = нет голосования)
  /** Matrix room id (только БД, не блокчейн) */
  matrix_room_id?: string | null;
  /** Сообщения Matrix об анонсе компонента в чатах родителя (event_id для правки/redact; без закрепа). */
  matrix_component_announcement_events?: IProjectMatrixComponentAnnouncementEvent[];
  /** URL репозитория разработки (GitHub), только БД — PRD §6.2.1 / эпик 6. */
  development_repository_url?: string | null;
  /** Приоритет проекта/компонента (только БД, в блокчейн не пишется). */
  priority?: string;
  /** blockchain | local */
  origin?: string;
  /** Владелец LOCAL-проекта */
  local_owner?: string | null;
};
