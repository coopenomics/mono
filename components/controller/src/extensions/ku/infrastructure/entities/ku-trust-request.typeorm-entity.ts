import { Entity, Column, Index } from 'typeorm';
import { BaseTypeormEntity } from '~/shared/sync/entities/base-typeorm.entity';

export const EntityName = 'ku_trust_requests';

@Entity(EntityName)
@Index(`idx_${EntityName}_blockchain_id`, ['id'])
@Index(`idx_${EntityName}_hash`, ['hash'], { unique: true })
@Index(`idx_${EntityName}_coopname`, ['coopname'])
@Index(`idx_${EntityName}_braname`, ['braname'])
@Index(`idx_${EntityName}_username`, ['username'])
export class KuTrustRequestTypeormEntity extends BaseTypeormEntity {
  static getTableName(): string {
    return EntityName;
  }

  @Column({ type: 'integer', nullable: true })
  id!: number;

  // Поля из блокчейна (table_branch_trustreqs.hpp)
  @Column({ type: 'varchar' })
  hash!: string;

  @Column({ type: 'varchar', length: 12 })
  coopname!: string;

  @Column({ type: 'varchar', length: 12 })
  braname!: string;

  @Column({ type: 'varchar', length: 12 })
  username!: string;

  @Column({ type: 'jsonb', nullable: true })
  application!: object;

  @Column({ type: 'jsonb', nullable: true })
  authority!: object;
}
