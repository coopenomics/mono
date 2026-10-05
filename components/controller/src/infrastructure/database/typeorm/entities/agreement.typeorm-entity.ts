import { AgreementStatus } from '~/domain/agreement/enums/agreement-status.enum';
import type { ISignedDocument } from '@coopenomics/innercoop';
import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'agreements';
export class AgreementTypeormEntity extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }

  id?: number;

  // Поля из блокчейна (soviet.hpp, таблица agreements3)
  coopname!: string;

  username!: string;

  type!: string;

  program_id!: number;

  draft_id!: number;

  version!: number;

  document!: ISignedDocument;

  blockchain_status!: string;

  updated_at!: Date;

  // Доменные поля (расширения)
  status!: AgreementStatus;
}
