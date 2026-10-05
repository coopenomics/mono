import { ResultStatus } from '../../domain/enums/result-status.enum';
import type { ISignedDocument } from '@coopenomics/innercoop';
import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'capital_results';
export class ResultRecord extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }
  id!: number;

  // Поля из блокчейна (results.hpp)
  project_hash!: string;

  result_hash!: string;

  coopname!: string;

  username!: string;

  blockchain_status!: string;

  created_at!: Date;

  debt_amount!: string;

  total_amount!: string;

  statement!: ISignedDocument;

  authorization!: ISignedDocument;

  act!: ISignedDocument;

  data?: string;

  // Доменные поля (расширения)
  status!: ResultStatus;
}
