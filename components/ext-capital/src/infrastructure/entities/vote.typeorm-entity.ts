import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseTypeormEntity } from '~/shared/sync/entities/base-typeorm.entity';
import { ContributorTypeormEntity } from './contributor.typeorm-entity';

export const EntityName = 'capital_votes';
@Entity(EntityName)
@Index(`idx_${EntityName}_blockchain_id`, ['id'])
@Index(`idx_${EntityName}_coopname`, ['coopname'])
@Index(`idx_${EntityName}_project_hash`, ['project_hash'])
@Index(`idx_${EntityName}_voter`, ['voter'])
@Index(`idx_${EntityName}_recipient`, ['recipient'])
@Index(`idx_${EntityName}_created_at`, ['_created_at'])
export class VoteTypeormEntity extends BaseTypeormEntity {
  static getTableName(): string {
    return EntityName;
  }
  @Column({ type: 'integer', nullable: true, unique: true })
  id!: number;

  // Поля из блокчейна (votes.hpp)
  @Column({ type: 'varchar', length: 12 })
  coopname!: string;
  @Column({ type: 'varchar' })
  project_hash!: string;

  @Column({ type: 'varchar' })
  voter!: string;

  // Связь с голосующим для получения display_name
  @ManyToOne(() => ContributorTypeormEntity, {
    nullable: true,
    createForeignKeyConstraints: false, // Отключаем foreign key constraint из-за неуникальности username
  })
  @JoinColumn({
    name: 'voter',
    referencedColumnName: 'username',
  })
  voter_contributor?: ContributorTypeormEntity;

  @Column({ type: 'varchar' })
  recipient!: string;

  @Column({ type: 'varchar' })
  amount!: string;

  @Column({ type: 'timestamp' })
  voted_at!: Date;

  // Связь с получателем голоса для получения display_name
  @ManyToOne(() => ContributorTypeormEntity, {
    nullable: true,
    createForeignKeyConstraints: false, // Отключаем foreign key constraint из-за неуникальности username
  })
  @JoinColumn({
    name: 'recipient',
    referencedColumnName: 'username',
  })
  recipient_contributor?: ContributorTypeormEntity;
}
