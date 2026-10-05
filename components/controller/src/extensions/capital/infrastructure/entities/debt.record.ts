import { DebtStatus } from '../../domain/enums/debt-status.enum';
import type { ISignedDocument } from '@coopenomics/innercoop';
import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'capital_debts';
export class DebtRecord extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }
  id!: number;

  // Поля из блокчейна (debts.hpp)
  coopname!: string;

  username!: string;

  debt_hash!: string;

  project_hash!: string;

  blockchain_status!: string;

  repaid_at!: Date;

  // Сумма — актив строкой («5033.0000 RUB»), как её отдаёт цепь.
  amount!: string;

  statement!: ISignedDocument;

  approved_statement!: ISignedDocument;

  authorization!: ISignedDocument;

  memo!: string;

  // Цепь даты создания записи не хранит — колонка необязательна (время появления в базе — `_created_at`).
  created_at!: Date;

  // Доменные поля (расширения)
  status!: DebtStatus;
}
