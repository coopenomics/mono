import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'capital_program_wallets';
export class ProgramWalletTypeormEntity extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }
  id!: number;

  // Поля из блокчейна (wallets.hpp)
  coopname!: string;

  username!: string;

  last_program_crps!: number;

  capital_available!: string;
}
