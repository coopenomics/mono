/**
 * Доменный интерфейс для действия создания проектного имущественного взноса CAPITAL контракта
 */
export interface CreateProjectPropertyDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Имя пользователя */
  username: string;

  /** Хэш проекта */
  project_hash: string;

  /** Хэш имущества */
  property_hash: string;

  /** Сумма имущества */
  property_amount: string;

  /** Описание имущества */
  property_description: string;
}
