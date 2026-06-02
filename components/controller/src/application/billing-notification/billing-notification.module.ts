import { Module } from '@nestjs/common';
import { AccountDomainModule } from '~/domain/account/account-domain.module';
import { BillingNotificationController } from './controllers/billing-notification.controller';
import { BillingNotificationBridgeService } from './services/billing-notification-bridge.service';

/**
 * Epic 14 — модуль входящих биллинговых оповещений (провайдер → coopback → Novu).
 *
 * NotificationSenderService доступен из глобального NotificationModule
 * (@Global), поэтому отдельно его не импортируем. AccountDomainModule нужен
 * для резолва отображаемого имени кооператива.
 */
@Module({
  imports: [AccountDomainModule],
  controllers: [BillingNotificationController],
  providers: [BillingNotificationBridgeService],
})
export class BillingNotificationModule {}
