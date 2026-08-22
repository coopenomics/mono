import { registerEnumType } from '@nestjs/graphql';
import {
  NotificationOutboxStatus,
  NotificationDeliveryStatus,
} from '~/domain/notification/interfaces/notification-outbox.domain.interface';
import { NotificationChannel } from '~/domain/notification/interfaces/notify-input.domain.interface';

// Регистрация enum'ов Центра уведомлений в GraphQL-схеме (канон: статусы — enum, не строки).
registerEnumType(NotificationOutboxStatus, {
  name: 'NotificationOutboxStatus',
  description: 'Статус строки очереди доставки уведомления',
});

registerEnumType(NotificationDeliveryStatus, {
  name: 'NotificationDeliveryStatus',
  description: 'Исход одной попытки доставки',
});

registerEnumType(NotificationChannel, {
  name: 'NotificationChannel',
  description: 'Канал доставки уведомления',
});
