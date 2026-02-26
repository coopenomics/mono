/**
 * Доменный интерфейс для действия запуска проекта CAPITAL контракта
 */
export interface StartProjectDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Хэш проекта */
  project_hash: string;
}
