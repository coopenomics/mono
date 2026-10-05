import { InvestStatus } from '../../domain/enums/invest-status.enum';
import type { ISignedDocument } from '@coopenomics/innercoop';
import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'capital_invests';
export class InvestTypeormEntity extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }
  id!: number;

  // Поля из блокчейна (invests.hpp)
  coopname!: string;

  username!: string;

  invest_hash!: string;

  project_hash!: string;

  blockchain_status!: string;

  // Сумма — актив строкой («5033.0000 RUB»), как её отдаёт цепь.
  amount!: string;

  invested_at!: Date;

  statement!: ISignedDocument;

  coordinator!: string;

  coordinator_amount!: string;

  // Цепь даты создания записи не хранит — колонка необязательна (время появления в базе — `_created_at`).
  created_at!: Date;

  // Доменные поля (расширения)
  status!: InvestStatus;
}
