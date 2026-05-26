import { Module } from '@nestjs/common';
import { BillingService } from './services/billing.service';
import { BillingResolver } from './resolvers/billing.resolver';

/**
 * Модуль billing (Epic 12) — GraphQL-мутации оплаты подписок (convert/pay).
 * Blockchain-порт (`BILLING_BLOCKCHAIN_PORT`) предоставляется глобальным
 * BlockchainModule. Подключается в корневой AppModule.
 */
@Module({
  providers: [BillingService, BillingResolver],
  exports: [BillingService],
})
export class BillingModule {}
