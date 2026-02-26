import { Entity, Column, Index } from 'typeorm';
import { AppendixStatus } from '../../domain/enums/appendix-status.enum';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import { BaseTypeormEntity } from '~/shared/sync/entities/base-typeorm.entity';

export const EntityName = 'capital_appendixes';
@Entity(EntityName)
@Index(`idx_${EntityName}_blockchain_id`, ['id'])
@Index(`idx_${EntityName}_appendix_hash`, ['appendix_hash'])
@Index(`idx_${EntityName}_username`, ['username'])
@Index(`idx_${EntityName}_project_hash`, ['project_hash'])
@Index(`idx_${EntityName}_status`, ['status'])
@Index(`idx_${EntityName}_created_at`, ['_created_at'])
export class AppendixTypeormEntity extends BaseTypeormEntity {
  static getTableName(): string {
    return EntityName;
  }
  @Column({ type: 'integer', nullable: true, unique: true })
  id!: number;

  // Поля из блокчейна (appendix.hpp)
  @Column({ type: 'varchar', nullable: true })
  coopname!: string;

  @Column({ type: 'varchar', nullable: true })
  username!: string;

  @Column({ type: 'varchar', nullable: true })
  project_hash!: string;

  @Column({ type: 'varchar' })
  appendix_hash!: string;

  @Column({ type: 'varchar', nullable: true })
  blockchain_status!: string;

  @Column({ type: 'timestamp', nullable: true })
  created_at!: Date;

  @Column({ type: 'json', nullable: true })
  appendix!: ISignedDocumentDomainInterface;

  @Column({ type: 'text', nullable: true })
  contribution?: string;

  // Доменные поля (расширения)
  @Column({
    type: 'enum',
    enum: AppendixStatus,
    default: AppendixStatus.CREATED,
  })
  status!: AppendixStatus;
}
