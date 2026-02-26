/**
 * Доменный интерфейс для действия добавления автора проекта CAPITAL контракта
 */
export interface AddAuthorDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Хэш проекта */
  project_hash: string;

  /** Имя автора */
  author: string;
}
