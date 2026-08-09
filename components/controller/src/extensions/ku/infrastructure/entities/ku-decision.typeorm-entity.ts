import { Entity, Column, Index } from 'typeorm';
import { BaseTypeormEntity } from '@coopenomics/extension-kit/sync';

export const EntityName = 'ku_decisions';

@Entity(EntityName)
@Index(`idx_${EntityName}_blockchain_id`, ['id'])
@Index(`idx_${EntityName}_hash`, ['hash'], { unique: true })
@Index(`idx_${EntityName}_coopname`, ['coopname'])
@Index(`idx_${EntityName}_type`, ['type'])
@Index(`idx_${EntityName}_braname`, ['braname'])
@Index(`idx_${EntityName}_initiator`, ['initiator'])
@Index(`idx_${EntityName}_created_at`, ['_created_at'])
export class KuDecisionTypeormEntity extends BaseTypeormEntity {
  static getTableName(): string {
    return EntityName;
  }

  @Column({ type: 'integer', nullable: true })
  id!: number;

  // Поля из блокчейна (table_branch_decisions.hpp)
  @Column({ type: 'varchar' })
  hash!: string;

  @Column({ type: 'varchar', length: 12 })
  coopname!: string;

  @Column({ type: 'varchar', length: 12 })
  type!: string;

  @Column({ type: 'varchar', length: 12 })
  initiator!: string;

  @Column({ type: 'varchar', length: 12, default: '' })
  chairman!: string;

  @Column({ type: 'jsonb', nullable: true })
  proposal!: object;

  @Column({ type: 'jsonb', nullable: true })
  protocol!: object;

  @Column({ type: 'jsonb', nullable: true })
  petition!: object;

  @Column({ type: 'jsonb', nullable: true })
  liability!: object;

  @Column({ type: 'jsonb', nullable: true })
  authority!: object;

  @Column({ type: 'jsonb', nullable: true })
  authorization!: object;

  @Column({ type: 'timestamp', nullable: true })
  open_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  close_at!: Date;

  @Column({ type: 'integer', default: 0 })
  signed_ballots!: number;

  @Column({ type: 'varchar', length: 12, default: '' })
  braname!: string;

  @Column({ type: 'varchar', default: '' })
  address!: string;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  participants!: string[];

  @Column({ type: 'timestamp', nullable: true })
  created_at!: Date;

  // Приватные данные собрания — только БД, в блокчейн не публикуются
  @Column({ type: 'varchar', nullable: true })
  meet_place!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  meet_at!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  branch_name!: string | null;

  @Column({ type: 'varchar', nullable: true })
  branch_email!: string | null;

  @Column({ type: 'varchar', nullable: true })
  branch_phone!: string | null;

  @Column({ type: 'boolean', default: false })
  cancelled!: boolean;

  // напоминание участникам за час до собрания уже отправлено
  @Column({ type: 'boolean', default: false })
  meet_reminder_sent!: boolean;
}
