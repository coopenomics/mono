import { Field, InputType } from '@nestjs/graphql';
import {
  NotificationOutboxStatus,
} from '~/domain/notification/interfaces/notification-outbox.domain.interface';
import { NotificationChannel } from '~/domain/notification/interfaces/notify-input.domain.interface';
import './notification-enums';

/** Фильтры журнала уведомлений (стол председателя). */
@InputType('NotificationsFilterInput')
export class NotificationsFilterInput {
  @Field(() => String, { description: 'Кооператив-владелец' })
  coopname!: string;

  @Field(() => String, { nullable: true, description: 'Тип уведомления' })
  workflowId?: string;

  @Field(() => NotificationChannel, { nullable: true, description: 'Канал доставки' })
  channel?: NotificationChannel;

  @Field(() => NotificationOutboxStatus, { nullable: true, description: 'Статус доставки' })
  status?: NotificationOutboxStatus;

  @Field(() => String, { nullable: true, description: 'Идентификатор получателя' })
  recipientSubscriberId?: string;
}
