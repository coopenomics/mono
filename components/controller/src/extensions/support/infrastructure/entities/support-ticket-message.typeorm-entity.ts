import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index, Check, ManyToOne, JoinColumn } from 'typeorm';
import { SupportMessageAuthorRole } from '../../domain/enums/support-message-author-role.enum';
import { SupportSystemEvent } from '../../domain/enums/support-system-event.enum';
import { SupportTicketTypeormEntity } from './support-ticket.typeorm-entity';

export const SupportTicketMessageEntityName = 'support_ticket_messages';

/**
 * Нет `updatedAt`: переписка только дописывается, правка задним числом
 * исключена — интерфейс репозитория (`SupportTicketMessageRepository`)
 * содержит только `append`, метода обновления нет вовсе (модель, раздел 4).
 */
@Entity(SupportTicketMessageEntityName)
@Check(
  `(author_role = 'SYSTEM' AND system_event IS NOT NULL AND body IS NULL)` +
    ` OR (author_role <> 'SYSTEM' AND system_event IS NULL AND body IS NOT NULL AND author_username IS NOT NULL)`
)
@Index(`idx_${SupportTicketMessageEntityName}_ticket_created`, ['ticketId', 'createdAt'])
export class SupportTicketMessageTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ticket_id' })
  ticketId!: string;

  @ManyToOne(() => SupportTicketTypeormEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ticket_id' })
  ticket!: SupportTicketTypeormEntity;

  /** NULL только у действий самой системы (автозакрытие) — см. @Check выше. */
  @Column({ name: 'author_username', type: 'varchar', length: 64, nullable: true })
  authorUsername!: string | null;

  @Column({ name: 'author_role', type: 'varchar', length: 16 })
  authorRole!: SupportMessageAuthorRole;

  @Column({ type: 'text', nullable: true })
  body!: string | null;

  @Column({ name: 'system_event', type: 'varchar', length: 32, nullable: true })
  systemEvent!: SupportSystemEvent | null;

  @Column({ type: 'jsonb', nullable: true })
  payload!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
