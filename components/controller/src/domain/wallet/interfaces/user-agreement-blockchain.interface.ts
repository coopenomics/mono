import type { WalletContract } from 'cooptypes';

export type IProgramAgreement = WalletContract.Tables.Users.IProgramAgreement;

/**
 * Данные строки `wallet::users` (owner программных соглашений пайщика).
 *
 * `coopname` приходит из `delta.scope`, не из value (scope-таблица).
 */
export interface IUserAgreementBlockchainData {
  coopname: string;
  username: string;
  programs: IProgramAgreement[];
}
