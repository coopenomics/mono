import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationOutboxTypeormEntity } from '~/infrastructure/database/typeorm/entities/notification-outbox.typeorm-entity';
import { NotificationDeliveryTypeormEntity } from '~/infrastructure/database/typeorm/entities/notification-delivery.typeorm-entity';
import { NotificationInboxTypeormEntity } from '~/infrastructure/database/typeorm/entities/notification-inbox.typeorm-entity';
import {
  EMAIL_CHANNEL_PORT,
  IN_APP_CHANNEL_PORT,
  WEB_PUSH_CHANNEL_PORT,
} from '~/domain/notification/interfaces/channel.ports';
import { NotificationModule } from '~/application/notification/notification.module';
import { NotificationService } from './notification.service';
import { OutboxWorkerService } from './outbox-worker.service';
import { NotificationJournalService } from './notification-journal.service';
import { NotificationJournalResolver } from './notification-journal.resolver';
import { NotificationInboxService } from './notification-inbox.service';
import { NotificationInboxResolver } from './notification-inbox.resolver';
import { EmailChannelAdapter } from './channels/email-channel.adapter';
import { InAppChannelAdapter } from './channels/in-app-channel.adapter';
import { WebPushChannelAdapter } from './channels/web-push-channel.adapter';

/**
 * Центр уведомлений (DC v3) — единый вход уведомлений кооператива.
 *
 * Экспортирует `NotificationService` — реализацию `INotificationPort` из
 * `@coopenomics/innercoop`. Сам токен порта привязан в `InnercoopBridgeModule`
 * вместе с остальными: одно место, где известны обе стороны.
 *
 * `@Global` — центр уведомлений cross-cutting: около двенадцати модулей ядра
 * пользуются им, не импортируя этот модуль у себя.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationOutboxTypeormEntity,
      NotificationDeliveryTypeormEntity,
      NotificationInboxTypeormEntity,
    ]),
    NotificationModule, // WebPushService для web-push канала
  ],
  providers: [
    NotificationService,
    OutboxWorkerService,
    NotificationJournalService,
    NotificationJournalResolver,
    NotificationInboxService,
    NotificationInboxResolver,
    EmailChannelAdapter,
    InAppChannelAdapter,
    WebPushChannelAdapter,
    {
      provide: EMAIL_CHANNEL_PORT,
      useExisting: EmailChannelAdapter,
    },
    {
      provide: IN_APP_CHANNEL_PORT,
      useExisting: InAppChannelAdapter,
    },
    {
      provide: WEB_PUSH_CHANNEL_PORT,
      useExisting: WebPushChannelAdapter,
    },
  ],
  exports: [
    EMAIL_CHANNEL_PORT,
    IN_APP_CHANNEL_PORT,
    WEB_PUSH_CHANNEL_PORT,
    NotificationService,
  ],
})
export class NotificationCenterModule {}
