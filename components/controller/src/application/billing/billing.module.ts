import { Module } from '@nestjs/common';
import { BillingService } from './services/billing.service';
import { BillingResolver } from './resolvers/billing.resolver';
import { BillingProviderClient } from '~/infrastructure/billing/billing-provider.client';
import { BillingConversionListener } from '~/infrastructure/billing/billing-conversion.listener';
import { BillingPaymentListener } from '~/infrastructure/billing/billing-payment.listener';
import { BillingCronService } from '~/domain/billing/services/billing-cron.service';
import { ProviderModule } from '~/application/provider/provider.module';
import { DocumentDomainModule } from '~/domain/document/document.module';

/**
 * Модуль billing (Epic 12 / Single-Hub v5):
 * - GraphQL-мутации оплаты подписок (convert/pay) — BillingResolver/BillingService;
 * - периодическое списание — BillingCronService + HTTP-клиент провайдера;
 * - список коопов для тика берётся из on-chain `registrator.coops` через
 *   ProviderService (никаких env-CSV).
 *
 * Blockchain-порт (`BILLING_BLOCKCHAIN_PORT`) предоставляется глобальным
 * BlockchainModule. Подключается в корневой AppModule только при
 * BILLING_HUB_MODE=true.
 *
 * BillingConversionListener ловит on-chain `billing::converttoaxn` с шины
 * `action::` (от парсера блокчейна) и реактивно уведомляет провайдера.
 * BillingPaymentListener аналогично ловит `billing::pay` — второй (реактивный)
 * путь подтверждения time-оплат; первый — синхронный confirm в cron'е.
 */
@Module({
  imports: [ProviderModule, DocumentDomainModule],
  providers: [
    BillingService,
    BillingResolver,
    BillingProviderClient,
    BillingConversionListener,
    BillingPaymentListener,
    BillingCronService,
  ],
  exports: [BillingService],
})
export class BillingModule {}
