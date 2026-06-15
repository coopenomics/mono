import { Entity, Column, Index } from 'typeorm';
import { BaseTypeormEntity } from '~/shared/sync/entities/base-typeorm.entity';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import type {
  IExpenseItemBlockchainData,
  IExpenseProposalCallbackHandler,
} from '../../domain/interfaces/expense-proposal-blockchain.interface';
import { ExpenseProposalStatus } from '../../domain/enums/expense-proposal-status.enum';

export const EntityName = 'expense_proposals';

@Entity(EntityName)
@Index(`idx_${EntityName}_blockchain_id`, ['id'])
@Index(`idx_${EntityName}_proposal_hash`, ['proposal_hash'])
@Index(`idx_${EntityName}_coopname_username`, ['coopname', 'username'])
@Index(`idx_${EntityName}_status`, ['status'])
@Index(`idx_${EntityName}_created_at`, ['_created_at'])
export class ExpenseProposalTypeormEntity extends BaseTypeormEntity {
  static getTableName(): string {
    return EntityName;
  }

  @Column({ type: 'integer', nullable: true, unique: true })
  id!: number;

  @Column({ type: 'varchar' })
  proposal_hash!: string;

  @Column({ type: 'varchar' })
  coopname!: string;

  @Column({ type: 'varchar' })
  username!: string;

  @Column({ type: 'varchar' })
  source_wallet!: string;

  @Column({ type: 'integer', nullable: true })
  blockchain_status!: number;

  @Column({ type: 'jsonb', nullable: true })
  items!: IExpenseItemBlockchainData[];

  @Column({ type: 'varchar' })
  total_planned!: string;

  @Column({ type: 'varchar' })
  total_actual!: string;

  @Column({ type: 'jsonb', nullable: true })
  callback!: IExpenseProposalCallbackHandler | null;

  @Column({ type: 'jsonb', nullable: true })
  statement_doc!: ISignedDocumentDomainInterface | null;

  @Column({ type: 'jsonb', nullable: true })
  decision_doc!: ISignedDocumentDomainInterface | null;

  @Column({ type: 'timestamp', nullable: true })
  created_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  updated_at!: Date;

  @Column({
    type: 'enum',
    enum: ExpenseProposalStatus,
    default: ExpenseProposalStatus.UNDEFINED,
  })
  status!: ExpenseProposalStatus;
}
