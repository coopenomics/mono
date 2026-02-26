/**
 * Доменный интерфейс для действия удаления проекта CAPITAL контракта
 */
export interface DeleteProjectDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Хэш проекта */
  project_hash: string;
}
