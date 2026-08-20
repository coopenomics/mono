import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, Check, Generated } from 'typeorm';
import { SupportTicketKind } from '../../domain/enums/support-ticket-kind.enum';
import { SupportTicketStatus } from '../../domain/enums/support-ticket-status.enum';
import { SupportTicketPriority } from '../../domain/enums/support-ticket-priority.enum';
import { SupportResponsibilityZone } from '../../domain/enums/support-responsibility-zone.enum';

export const SupportTicketEntityName = 'support_tickets';

/**
 * Off-chain, плоская сущность — блокчейна и синхронизации нет (модель, раздел 1).
 * `BaseTypeormEntity` не наследуется: его `block_num`/`present` — поля зеркала
 * блокчейна, зеркалить тут нечего.
 *
 * `coopname` хранится только здесь и намеренно не входит ни в один индекс:
 * база у каждого кооператива своя, колонка одинакова во всех строках.
 */
@Entity(SupportTicketEntityName)
@Check(`status <> 'RESOLVED' OR resolved_at IS NOT NULL`)
@Index(`idx_${SupportTicketEntityName}_status_last_message`, ['status', 'lastMessageAt'])
@Index(`idx_${SupportTicketEntityName}_author_created`, ['authorUsername', 'createdAt'])
@Index(`idx_${SupportTicketEntityName}_assignee_status`, ['assigneeUsername', 'status'])
@Index(`idx_${SupportTicketEntityName}_resolved_at`, ['resolvedAt'], { where: `status = 'RESOLVED'` })
@Index(`idx_${SupportTicketEntityName}_kind_status`, ['kind', 'status'])
@Index(`idx_${SupportTicketEntityName}_escalated_at`, ['escalatedAt'], { where: `escalated_at IS NOT NULL` })
export class SupportTicketTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Человеко-читаемый номер — настоящая postgres-последовательность
   * (`@Generated('increment')`), не UUID. Bigint приходит из PG строкой,
   * поэтому TS-тип — `string` (canon: bigint никогда не читаем как number).
   */
  @Column({ type: 'bigint' })
  @Generated('increment')
  @Index(`uq_${SupportTicketEntityName}_number`, { unique: true })
  number!: string;

  @Column({ name: 'coopname', type: 'varchar', length: 64 })
  coopname!: string;

  @Column({ type: 'varchar', length: 32 })
  kind!: SupportTicketKind;

  @Column({ type: 'varchar', length: 32 })
  status!: SupportTicketStatus;

  @Column({ type: 'varchar', length: 16, default: SupportTicketPriority.NORMAL })
  priority!: SupportTicketPriority;

  @Column({ type: 'varchar', length: 255 })
  subject!: string;

  @Column({ name: 'author_username', type: 'varchar', length: 64 })
  authorUsername!: string;

  @Column({ name: 'assignee_username', type: 'varchar', length: 64, nullable: true })
  assigneeUsername!: string | null;

  @Column({ name: 'responsibility_zone', type: 'varchar', length: 16, default: SupportResponsibilityZone.COOPERATIVE })
  responsibilityZone!: SupportResponsibilityZone;

  @Column({ name: 'last_message_at', type: 'timestamptz' })
  lastMessageAt!: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ name: 'escalated_at', type: 'timestamptz', nullable: true })
  escalatedAt!: Date | null;

  @Column({ name: 'reopen_count', type: 'integer', default: 0 })
  reopenCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
