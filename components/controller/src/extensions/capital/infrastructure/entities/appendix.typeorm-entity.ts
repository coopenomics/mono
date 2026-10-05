import { AppendixStatus } from '../../domain/enums/appendix-status.enum';
import type { ISignedDocument } from '@coopenomics/innercoop';
import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'capital_appendixes';
export class AppendixTypeormEntity extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }
  id!: number;

  // Поля из блокчейна (appendix.hpp)
  coopname!: string;

  username!: string;

  project_hash!: string;

  appendix_hash!: string;

  blockchain_status!: string;

  created_at!: Date;

  appendix!: ISignedDocument;

  contribution?: string;

  // Доменные поля (расширения)
  status!: AppendixStatus;
}
