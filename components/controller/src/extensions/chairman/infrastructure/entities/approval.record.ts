import { ApprovalStatus } from '../../domain/enums/approval-status.enum';
import type { ISignedDocument } from '@coopenomics/innercoop';
import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'chairman_approvals';

/** Запись зеркала одобрений председателя (таблица цепи `approvals`). */
export class ApprovalRecord extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }

  id!: number;

  coopname!: string;

  username!: string;

  document!: ISignedDocument;

  approval_hash!: string;

  callback_contract!: string;

  callback_action_approve!: string;

  callback_action_decline!: string;

  meta!: string;

  created_at!: Date;

  approved_document?: ISignedDocument;

  status!: ApprovalStatus;
}
