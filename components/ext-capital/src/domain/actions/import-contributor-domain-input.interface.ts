/**
 * Доменный интерфейс для действия импорта участника в CAPITAL контракт
 */
export interface ImportContributorDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Имя аккаунта пользователя */
  username: string;

  /** Сумма вклада */
  contribution_amount: string;

  /** Номер договора участника */
  contributor_contract_number: string;

  /** Дата создания договора участника (в формате DD.MM.YYYY) */
  contributor_contract_created_at: string;

  /** Примечание */
  memo?: string;
}
