/**
 * Доменный интерфейс для действия установки мастера проекта CAPITAL контракта
 */
export interface SetMasterDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Хэш проекта */
  project_hash: string;

  /** Имя мастера проекта */
  master: string;
}
