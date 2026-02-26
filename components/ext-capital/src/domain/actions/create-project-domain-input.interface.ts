/**
 * Доменный интерфейс для действия создания проекта CAPITAL контракта
 */
export interface CreateProjectDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Хэш проекта */
  project_hash: string;

  /** Хэш родительского проекта (или мета-проекта) */
  parent_hash: string;

  /** Название проекта */
  title: string;

  /** Описание проекта */
  description: string;

  /** Приглашение к проекту */
  invite: string;

  /** Мета-данные проекта */
  meta: string;

  /** Данные/шаблон проекта */
  data: string;
}
