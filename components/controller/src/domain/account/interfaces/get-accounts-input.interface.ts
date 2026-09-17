import type { AccountVerificationFilter } from '../utils/account-verification-filter';

export interface GetAccountsInputDomainInterface {
  role?: string;
  /** Отбор по уровню верификации; уровни читаются из цепи. */
  verification?: AccountVerificationFilter;
}
