import { Global, Module } from '@nestjs/common';
import { SubscriptionResolver } from './resolvers/web-push-subscription.resolver';
import { NotificationResolver } from './resolvers/notification.resolver';
import { SubscriptionService } from './services/subscription.service';
import { NotificationService } from './services/notification.service';
import { NotificationInteractor } from './interactors/notification.interactor';
import { CleanupService } from './services/cleanup.service';
import { NotificationSenderService } from './services/notification-sender.service';
import { NotificationEventService } from './services/notification-event.service';
import { WebPushService } from './services/web-push.service';
import { AccountDomainModule } from '~/domain/account/account-domain.module';
import { UserDomainModule } from '~/domain/user/user-domain.module';

/**
 * Модуль приложения для управления уведомлениями.
 * Веб-пуш подписки (web_push_subscriptions), резолверы и фасады отправки.
 * Доставка по каналам — Центр уведомлений (NotificationCenterModule).
 */
@Global()
@Module({
  imports: [AccountDomainModule, UserDomainModule],
  providers: [
    SubscriptionResolver,
    NotificationResolver,
    SubscriptionService,
    NotificationService,
    NotificationInteractor,
    CleanupService,
    NotificationSenderService,
    NotificationEventService,
    WebPushService,
  ],
  exports: [
    CleanupService,
    NotificationService,
    NotificationSenderService,
    WebPushService,
    NotificationInteractor,
  ],
})
export class NotificationModule {}
