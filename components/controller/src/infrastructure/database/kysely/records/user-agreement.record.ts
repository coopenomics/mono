import type { IProgramAgreement } from '~/domain/wallet/interfaces/user-agreement-blockchain.interface';
import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'user_agreements';

/**
 * Owner программных соглашений (`wallet::users`).
 *
 * Одна строка на (coopname, username); `programs` хранится как jsonb-массив
 * `IProgramAgreement[]`. Удалённая запись блокчейна → `present=false`,
 * строка остаётся для версионирования и форк-процедур.
 */
export class UserAgreementRecord extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }

  coopname!: string;

  username!: string;

  programs!: IProgramAgreement[];
}
