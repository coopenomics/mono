import { ProgramWithdrawStatus } from '../../domain/enums/program-withdraw-status.enum';
import type { ISignedDocument } from '@coopenomics/innercoop';
import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'capital_program_withdraws';
export class ProgramWithdrawTypeormEntity extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }
  id!: number;

  // Поля из блокчейна (program_withdraw.hpp)
  coopname!: string;

  withdraw_hash!: string;

  username!: string;

  blockchain_status!: string;

  amount!: string;

  statement!: ISignedDocument;

  created_at!: Date;

  // Доменные поля (расширения)
  status!: ProgramWithdrawStatus;
}
