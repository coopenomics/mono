import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'program_wallets';

/**
 * TypeORM сущность для программных кошельков
 * Хранит информацию о балансах пайщиков в целевых потребительских программах кооператива
 */
export class ProgramWalletRecord extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }

  id!: string;

  coopname!: string;

  program_id!: string;

  agreement_id!: string;

  username!: string;

  available!: string;

  blocked!: string;

  membership_contribution!: string;
}
