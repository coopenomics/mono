import { Entity, Column, Index } from 'typeorm';
import { ResultStatus } from '../../domain/enums/result-status.enum';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import { BaseTypeormEntity } from '~/shared/sync/entities/base-typeorm.entity';

export const EntityName = 'capital_results';
@Entity(EntityName)
@Index(`idx_${EntityName}_blockchain_id`, ['id'])
@Index(`idx_${EntityName}_result_hash`, ['result_hash'])
@Index(`idx_${EntityName}_project_hash`, ['project_hash'])
@Index(`idx_${EntityName}_username`, ['username'])
@Index(`idx_${EntityName}_status`, ['status'])
@Index(`idx_${EntityName}_created_at`, ['_created_at'])
export class ResultTypeormEntity extends BaseTypeormEntity {
  static getTableName(): string {
    return EntityName;
  }
  @Column({ type: 'integer', nullable: true })
  id!: number;

  // Поля из блокчейна (results.hpp)
  @Column({ type: 'varchar' })
  project_hash!: string;

  @Column({ type: 'varchar', unique: true })
  result_hash!: string;

  @Column({ type: 'varchar' })
  coopname!: string;

  @Column({ type: 'varchar' })
  username!: string;

  @Column({ type: 'varchar', nullable: true })
  blockchain_status!: string;

  @Column({ type: 'timestamp', nullable: true })
  created_at!: Date;

  @Column({ type: 'varchar', nullable: true })
  debt_amount!: string;

  @Column({ type: 'varchar', nullable: true })
  total_amount!: string;

  @Column({ type: 'json', nullable: true })
  statement!: ISignedDocumentDomainInterface;

  @Column({ type: 'json', nullable: true })
  authorization!: ISignedDocumentDomainInterface;

  @Column({ type: 'json', nullable: true })
  act!: ISignedDocumentDomainInterface;

  @Column({ type: 'text', nullable: true })
  data?: string;

  // Доменные поля (расширения)
  @Column({
    type: 'enum',
    enum: ResultStatus,
    default: ResultStatus.UNDEFINED,
  })
  status!: ResultStatus;
}
