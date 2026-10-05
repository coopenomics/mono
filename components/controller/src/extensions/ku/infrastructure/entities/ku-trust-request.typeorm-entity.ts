import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'ku_trust_requests';

export class KuTrustRequestTypeormEntity extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }

  id!: number;

  // Поля из блокчейна (table_branch_trustreqs.hpp)
  hash!: string;

  coopname!: string;

  braname!: string;

  username!: string;

  application!: object;

  authority!: object;
}
