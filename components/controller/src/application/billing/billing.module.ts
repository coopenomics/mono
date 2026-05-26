import { Module } from '@nestjs/common';
import { BillingService } from './services/billing.service';
import { BillingResolver } from './resolvers/billing.resolver';
import { BillingProviderClient } from '~/infrastructure/billing/billing-provider.client';
import { BillingCronService } from '~/domain/billing/services/billing-cron.service';

/**
 * Модуль billing (Epic 12):
 * - GraphQL-мутации оплаты подписок (convert/pay) — BillingResolver/BillingService;
 * - периодическое списание (Story 12.6) — BillingCronService + HTTP-клиент провайдера.
 *
 * Blockchain-порт (`BILLING_BLOCKCHAIN_PORT`) предоставляется глобальным
 * BlockchainModule. Подключается в корневой AppModule.
 */
@Module({
  providers: [BillingService, BillingResolver, BillingProviderClient, BillingCronService],
  exports: [BillingService],
})
export class BillingModule {}
