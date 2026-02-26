/**
 * Доменный интерфейс для действия финансирования программы CAPITAL контракта
 */
export interface FundProgramDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Сумма финансирования */
  amount: string;

  /** Memo */
  memo: string;
}
