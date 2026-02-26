/**
 * Доменный интерфейс для действия редактирования проекта CAPITAL контракта
 */
export interface EditProjectDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Хэш проекта для редактирования */
  project_hash: string;

  /** Новое название проекта */
  title: string;

  /** Новое описание проекта */
  description: string;

  /** Новое приглашение к проекту */
  invite: string;

  /** Новые мета-данные проекта */
  meta: string;

  /** Новые данные/шаблон проекта */
  data: string;

}
