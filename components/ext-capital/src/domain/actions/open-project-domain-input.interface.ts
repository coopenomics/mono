/**
 * Доменный интерфейс для действия открытия проекта для инвестиций CAPITAL контракта
 */
export interface OpenProjectDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Хэш проекта */
  project_hash: string;
}
