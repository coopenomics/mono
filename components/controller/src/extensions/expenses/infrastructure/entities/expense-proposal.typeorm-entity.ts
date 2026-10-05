import { ChainRecord } from '@coopenomics/extension-kit/sync';
import type { ISignedDocument } from '@coopenomics/innercoop';
import type {
  IExpenseItemBlockchainData,
  IExpenseProposalCallbackHandler,
} from '../../domain/interfaces/expense-proposal-blockchain.interface';
import { ExpenseProposalStatus } from '../../domain/enums/expense-proposal-status.enum';

export const EntityName = 'expense_proposals';

export class ExpenseProposalTypeormEntity extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }

  id!: number;

  proposal_hash!: string;

  coopname!: string;

  username!: string;

  source_wallet!: string;

  blockchain_status!: number;

  items!: IExpenseItemBlockchainData[];

  total_planned!: string;

  total_actual!: string;

  callback!: IExpenseProposalCallbackHandler | null;

  statement_doc!: ISignedDocument | null;

  decision_doc!: ISignedDocument | null;

  created_at!: Date;

  updated_at!: Date;

  status!: ExpenseProposalStatus;
}
