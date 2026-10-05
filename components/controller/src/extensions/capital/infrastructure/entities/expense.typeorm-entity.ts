import { ExpenseStatus } from '../../domain/enums/expense-status.enum';
import type { ISignedDocument } from '@coopenomics/innercoop';
import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'capital_expenses';
export class ExpenseTypeormEntity extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }
  id!: number;

  // Поля из блокчейна (expenses.hpp)
  coopname!: string;

  username!: string;

  project_hash!: string;

  expense_hash!: string;

  fund_id!: string;

  blockchain_status!: string;

  // Сумма — актив строкой («5033.0000 RUB»), как её отдаёт цепь.
  amount!: string;

  description!: string;

  expense_statement!: ISignedDocument;

  approved_statement!: ISignedDocument;

  authorization!: ISignedDocument;

  spended_at!: Date;

  // Цепь даты создания записи не хранит — колонка необязательна (время появления в базе — `_created_at`).
  created_at!: Date;

  // Доменные поля (расширения)
  status!: ExpenseStatus;
}
