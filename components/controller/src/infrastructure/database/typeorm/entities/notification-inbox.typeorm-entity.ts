import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { NotificationInboxDomainInterface } from '~/domain/notification/interfaces/notification-inbox.domain.interface';

/**
 * Личный инбокс Центра уведомлений (канал «In-app»).
 *
 * Одна строка = одно in-app уведомление получателя. Пишется `InAppChannelAdapter`
 * при доставке; читается резолверами инбокса (эпик 6) — лента, `unreadCount`,
 * отметка «прочитано». Каждый кооператив ведёт свой инбокс (federation-инвариант).
 */
@Entity('notification_inbox')
// Лента инбокса получателя + быстрый unreadCount (частичный по isRead).
@Index(['recipientSubscriberId', 'isRead', 'createdAt'])
// Инбокс по кооперативу (стол председателя / админ-обзор).
@Index(['coopname', 'createdAt'])
export class NotificationInboxTypeormEntity implements NotificationInboxDomainInterface {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { length: 255 })
  coopname!: string;

  @Column('uuid')
  outboxId!: string;

  @Column('varchar', { length: 255 })
  recipientSubscriberId!: string;

  @Column('varchar', { length: 255, nullable: true })
  recipientUsername?: string;

  @Column('varchar', { length: 255 })
  workflowId!: string;

  @Column('varchar', { length: 512 })
  title!: string;

  @Column('text')
  body!: string;

  // Record<string, any> (не unknown) — TypeORM QueryDeepPartialEntity не принимает unknown-значения при insert.
  @Column('json', { nullable: true })
  payload?: Record<string, any>;

  @Column('varchar', { length: 255, nullable: true })
  actorSubscriberId?: string;

  @Column('boolean', { default: false })
  isRead!: boolean;

  @Column('timestamp', { nullable: true })
  readAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
