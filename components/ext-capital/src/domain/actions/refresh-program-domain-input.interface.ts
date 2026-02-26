/**
 * Доменный интерфейс для действия обновления CRPS пайщика в программе CAPITAL контракта
 */
export interface RefreshProgramDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Имя пользователя */
  username: string;
}
