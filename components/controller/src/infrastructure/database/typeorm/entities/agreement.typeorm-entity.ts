import { Entity, Column, Index } from 'typeorm';
import { AgreementStatus } from '~/domain/agreement/enums/agreement-status.enum';
import type { ISignedDocument } from '@coopenomics/innercoop';
import { BaseTypeormEntity } from '@coopenomics/extension-kit/sync';

export const EntityName = 'agreements';
@Entity(EntityName)
@Index(`idx_${EntityName}_id`, ['id'])
@Index(`idx_${EntityName}_coopname`, ['coopname'])
@Index(`idx_${EntityName}_username`, ['username'])
@Index(`idx_${EntityName}_type`, ['type'])
@Index(`idx_${EntityName}_program_id`, ['program_id'])
@Index(`idx_${EntityName}_status`, ['status'])
@Index(`idx_${EntityName}_blockchain_status`, ['blockchain_status'])
export class AgreementTypeormEntity extends BaseTypeormEntity {
  static getTableName(): string {
    return EntityName;
  }

  @Column({ type: 'integer', nullable: true, unique: true })
  id?: number;

  // Поля из блокчейна (soviet.hpp, таблица agreements3)
  @Column({ type: 'varchar', length: 12 })
  coopname!: string;

  @Column({ type: 'varchar', length: 12 })
  username!: string;

  @Column({ type: 'varchar', length: 50 })
  type!: string;

  @Column({ type: 'integer' })
  program_id!: number;

  @Column({ type: 'integer' })
  draft_id!: number;

  @Column({ type: 'integer' })
  version!: number;

  @Column({ type: 'json' })
  document!: ISignedDocument;

  @Column({ type: 'varchar', length: 20 })
  blockchain_status!: string;

  @Column({ type: 'timestamp' })
  updated_at!: Date;

  // Доменные поля (расширения)
  @Column({
    type: 'enum',
    enum: AgreementStatus,
    default: AgreementStatus.REGISTERED,
  })
  status!: AgreementStatus;
}
