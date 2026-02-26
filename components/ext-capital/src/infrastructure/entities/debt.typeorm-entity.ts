import { Entity, Column, Index } from 'typeorm';
import { DebtStatus } from '../../domain/enums/debt-status.enum';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import { BaseTypeormEntity } from '~/shared/sync/entities/base-typeorm.entity';

export const EntityName = 'capital_debts';
@Entity(EntityName)
@Index(`idx_${EntityName}_blockchain_id`, ['id'])
@Index(`idx_${EntityName}_debt_hash`, ['debt_hash'])
@Index(`idx_${EntityName}_project_hash`, ['project_hash'])
@Index(`idx_${EntityName}_username`, ['username'])
@Index(`idx_${EntityName}_status`, ['status'])
@Index(`idx_${EntityName}_created_at`, ['_created_at'])
@Index(`idx_${EntityName}_repaid_at`, ['repaid_at'])
export class DebtTypeormEntity extends BaseTypeormEntity {
  static getTableName(): string {
    return EntityName;
  }
  @Column({ type: 'integer', nullable: true, unique: true })
  id!: number;

  // Поля из блокчейна (debts.hpp)
  @Column({ type: 'varchar', length: 12, nullable: true })
  coopname!: string;

  @Column({ type: 'varchar', length: 12, nullable: true })
  username!: string;

  @Column({ type: 'varchar', length: 64 })
  debt_hash!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  project_hash!: string;

  @Column({ type: 'varchar', length: 20 })
  blockchain_status!: string;

  @Column({ type: 'timestamp', nullable: true })
  repaid_at!: Date;

  @Column({ type: 'bigint' })
  amount!: string;

  @Column({ type: 'json' })
  statement!: ISignedDocumentDomainInterface;

  @Column({ type: 'json' })
  approved_statement!: ISignedDocumentDomainInterface;

  @Column({ type: 'json' })
  authorization!: ISignedDocumentDomainInterface;

  @Column({ type: 'text', nullable: true })
  memo!: string;

  @Column({ type: 'timestamp' })
  created_at!: Date;

  // Доменные поля (расширения)
  @Column({
    type: 'enum',
    enum: DebtStatus,
    default: DebtStatus.PENDING,
  })
  status!: DebtStatus;
}
