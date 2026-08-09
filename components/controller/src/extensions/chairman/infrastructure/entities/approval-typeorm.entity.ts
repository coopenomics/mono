import { Entity, Column, Index } from 'typeorm';
import { ApprovalStatus } from '../../domain/enums/approval-status.enum';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import { BaseTypeormEntity } from '@coopenomics/extension-kit/sync';

export const EntityName = 'chairman_approvals';
@Entity(EntityName)
@Index(`idx_${EntityName}_id`, ['id'])
@Index(`idx_${EntityName}_approval_hash`, ['approval_hash'])
@Index(`idx_${EntityName}_username`, ['username'])
@Index(`idx_${EntityName}_coopname`, ['coopname'])
@Index(`idx_${EntityName}_status`, ['status'])
export class ApprovalTypeormEntity extends BaseTypeormEntity {
  static getTableName(): string {
    return EntityName;
  }

  @Column({ type: 'integer', unique: true })
  id!: number;

  // Поля из блокчейна (approvals.hpp)
  @Column({ type: 'varchar', length: 12 })
  coopname!: string;

  @Column({ type: 'varchar', length: 12 })
  username!: string;

  @Column({ type: 'json' })
  document!: ISignedDocumentDomainInterface;

  @Column({ type: 'varchar', length: 64 })
  approval_hash!: string;

  @Column({ type: 'varchar', length: 12 })
  callback_contract!: string;

  @Column({ type: 'varchar', length: 12 })
  callback_action_approve!: string;

  @Column({ type: 'varchar', length: 12 })
  callback_action_decline!: string;

  @Column({ type: 'text' })
  meta!: string;

  @Column({ type: 'timestamp' })
  created_at!: Date;

  @Column({ type: 'json', nullable: true })
  approved_document?: ISignedDocumentDomainInterface;

  // Доменные поля (расширения) - переопределяем status с enum
  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  status!: ApprovalStatus;
}
