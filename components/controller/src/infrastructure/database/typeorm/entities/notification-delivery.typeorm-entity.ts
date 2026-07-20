import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { NotificationChannel } from '~/domain/notification/interfaces/notify-input.domain.interface';
import {
  NotificationDeliveryStatus,
  type NotificationDeliveryDomainInterface,
} from '~/domain/notification/interfaces/notification-outbox.domain.interface';

/**
 * Журнал доставок Центра уведомлений.
 *
 * Одна строка = одна попытка отправки outbox-строки и её исход. Источник для
 * «стола председателя» (кто/что/когда получил) и кнопки «переотправить» (эпик 6).
 * Только append — строки не обновляются.
 */
@Entity('notification_deliveries')
// Журнал кооператива по времени (стол председателя).
@Index(['coopname', 'createdAt'])
// Личный инбокс получателя по времени.
@Index(['recipientSubscriberId', 'createdAt'])
// Все попытки одной outbox-строки.
@Index(['outboxId'])
export class NotificationDeliveryTypeormEntity implements NotificationDeliveryDomainInterface {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  outboxId!: string;

  @Column('varchar', { length: 255 })
  coopname!: string;

  @Column('varchar', { length: 32 })
  channel!: NotificationChannel;

  @Column('varchar', { length: 255 })
  recipientSubscriberId!: string;

  @Column('varchar', { length: 255 })
  workflowId!: string;

  @Column('int')
  attemptNumber!: number;

  @Column('varchar', { length: 16 })
  status!: NotificationDeliveryStatus;

  @Column('text', { nullable: true })
  providerResponse?: string;

  @Column('text', { nullable: true })
  error?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
