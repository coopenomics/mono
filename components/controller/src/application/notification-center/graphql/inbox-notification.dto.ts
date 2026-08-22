import { Field, ObjectType, Int } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

/**
 * Уведомление личного инбокса пайщика (строка `notification_inbox`, канал In-app).
 *
 * Отдаётся read-side резолверами инбокса (эпик 6): лента по сессии получателя,
 * `unreadCount`, отметка «прочитано». Адресация — по immutable `subscriber_id`
 * текущей сессии (в DTO не выносим — получатель всегда сам пользователь).
 */
@ObjectType('InboxNotification')
export class InboxNotificationDTO {
  @Field(() => String, { description: 'Идентификатор уведомления инбокса' })
  id!: string;

  @Field(() => String, { description: 'Тип уведомления (Workflows.<Type>.id)' })
  workflowId!: string;

  @Field(() => String, { description: 'Заголовок' })
  title!: string;

  @Field(() => String, { description: 'Тело уведомления' })
  body!: string;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Исходные данные (deep-link / доп-рендер)' })
  payload?: Record<string, unknown>;

  @Field(() => String, { nullable: true, description: 'Инициатор уведомления (от кого)' })
  actorSubscriberId?: string;

  @Field(() => Boolean, { description: 'Прочитано получателем' })
  isRead!: boolean;

  @Field(() => Date, { nullable: true, description: 'Когда отмечено прочитанным' })
  readAt?: Date;

  @Field(() => Date, { description: 'Когда получено' })
  createdAt!: Date;
}

/** Счётчик непрочитанных уведомлений инбокса (для бейджа на колоколе). */
@ObjectType('UnreadNotificationsCount')
export class UnreadNotificationsCountDTO {
  @Field(() => Int, { description: 'Число непрочитанных уведомлений' })
  count!: number;
}
