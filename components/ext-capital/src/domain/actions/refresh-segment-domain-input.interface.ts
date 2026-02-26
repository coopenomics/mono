/**
 * Доменный интерфейс для действия обновления сегмента CAPITAL контракта
 */
export interface RefreshSegmentDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Хэш проекта */
  project_hash: string;

  /** Имя пользователя */
  username: string;
}
