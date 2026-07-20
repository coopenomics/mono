import { Field, ObjectType, Int } from '@nestjs/graphql';
import {
  NotificationOutboxStatus,
  NotificationDeliveryStatus,
} from '~/domain/notification/interfaces/notification-outbox.domain.interface';
import { NotificationChannel } from '~/domain/notification/interfaces/notify-input.domain.interface';
import './notification-enums';

/** Одна попытка доставки уведомления (строка журнала `notification_deliveries`). */
@ObjectType('NotificationAttempt')
export class NotificationAttemptDTO {
  @Field(() => String, { description: 'Идентификатор попытки' })
  id!: string;

  @Field(() => Int, { description: 'Номер попытки (1-based)' })
  attemptNumber!: number;

  @Field(() => NotificationDeliveryStatus, { description: 'Исход попытки' })
  status!: NotificationDeliveryStatus;

  @Field(() => String, { nullable: true, description: 'Ответ провайдера (message-id / push-status)' })
  providerResponse?: string;

  @Field(() => String, { nullable: true, description: 'Текст ошибки при провале' })
  error?: string;

  @Field(() => Date, { description: 'Когда выполнена попытка' })
  createdAt!: Date;
}

/** Уведомление в журнале (строка очереди `notification_outbox`). */
@ObjectType('Notification')
export class NotificationDTO {
  @Field(() => String, { description: 'Идентификатор уведомления' })
  id!: string;

  @Field(() => String, { description: 'Кооператив-владелец' })
  coopname!: string;

  @Field(() => String, { description: 'Тип уведомления' })
  workflowId!: string;

  @Field(() => NotificationChannel, { description: 'Канал доставки' })
  channel!: NotificationChannel;

  @Field(() => String, { description: 'Идентификатор получателя' })
  recipientSubscriberId!: string;

  @Field(() => String, { nullable: true, description: 'Имя аккаунта получателя' })
  recipientUsername?: string;

  @Field(() => NotificationOutboxStatus, { description: 'Статус доставки' })
  status!: NotificationOutboxStatus;

  @Field(() => Int, { description: 'Сделано попыток' })
  attempts!: number;

  @Field(() => String, { nullable: true, description: 'Текст последней ошибки' })
  lastError?: string;

  @Field(() => Date, { description: 'Когда поставлено в очередь' })
  createdAt!: Date;

  @Field(() => Date, { description: 'Когда обновлено' })
  updatedAt!: Date;
}

/** Детализация уведомления с историей попыток по каналу. */
@ObjectType('NotificationDetail')
export class NotificationDetailDTO extends NotificationDTO {
  @Field(() => [NotificationAttemptDTO], { description: 'История попыток доставки' })
  deliveries!: NotificationAttemptDTO[];
}
