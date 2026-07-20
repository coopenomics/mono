import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { NotificationChannel } from '~/domain/notification/interfaces/notify-input.domain.interface';
import {
  NotificationOutboxStatus,
  type NotificationOutboxDomainInterface,
} from '~/domain/notification/interfaces/notification-outbox.domain.interface';

/**
 * Транзакционный outbox Центра уведомлений.
 *
 * Одна строка = намерение доставить один тип уведомления одному получателю по
 * одному каналу. Пишется в транзакции вызывающего сервиса; отправку выполняет
 * фоновый worker (эпик 3), который выбирает строки по hot-path индексу
 * `(status, scheduled_at)`.
 */
@Entity('notification_outbox')
// Hot-path выборки worker'а: PENDING со scheduledAt ≤ now.
@Index(['status', 'scheduledAt'])
// Идемпотентность: повторный notify() с тем же ключом не плодит строк.
@Index(['idempotencyKey'], { unique: true })
// Журнал «кому что отправлено» по кооперативу.
@Index(['coopname', 'createdAt'])
export class NotificationOutboxTypeormEntity implements NotificationOutboxDomainInterface {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { length: 255 })
  coopname!: string;

  @Column('varchar', { length: 255 })
  workflowId!: string;

  @Column('varchar', { length: 32 })
  channel!: NotificationChannel;

  @Column('varchar', { length: 255 })
  recipientSubscriberId!: string;

  @Column('varchar', { length: 255, nullable: true })
  recipientEmail?: string;

  @Column('varchar', { length: 255, nullable: true })
  recipientUsername?: string;

  // Record<string, any> (не unknown) — TypeORM QueryDeepPartialEntity не принимает unknown-значения при insert.
  @Column('json', { nullable: true })
  payload?: Record<string, any>;

  @Column('varchar', { length: 255, nullable: true })
  actorSubscriberId?: string;

  @Column('varchar', { length: 64 })
  idempotencyKey!: string;

  @Column('varchar', { length: 16, default: NotificationOutboxStatus.PENDING })
  status!: NotificationOutboxStatus;

  @Column('int', { default: 0 })
  attempts!: number;

  @Column('int', { default: 5 })
  maxAttempts!: number;

  @Column('timestamp')
  scheduledAt!: Date;

  @Column('text', { nullable: true })
  lastError?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
