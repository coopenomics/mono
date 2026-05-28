import { Module } from '@nestjs/common';
import { BillingService } from './services/billing.service';
import { BillingResolver } from './resolvers/billing.resolver';
import { BillingProviderClient } from '~/infrastructure/billing/billing-provider.client';
import { BillingCronService } from '~/domain/billing/services/billing-cron.service';
import { PaymentConfirmedListener } from './listeners/payment-confirmed.listener';
import { ProviderModule } from '~/application/provider/provider.module';
import { DocumentDomainModule } from '~/domain/document/document.module';

/**
 * Модуль billing (Epic 12 / Single-Hub v5):
 * - GraphQL-мутации оплаты подписок (convert/pay) — BillingResolver/BillingService;
 * - периодическое списание — BillingCronService (создаёт invoice + сабмитит pay);
 * - подтверждение оплаты — PaymentConfirmedListener (ловит on-chain action::billing::pay
 *   через парсер, дёргает provider POST /billing/payment-confirmed);
 * - список коопов для тика берётся из on-chain `registrator.coops` через
 *   ProviderService (никаких env-CSV).
 *
 * Blockchain-порт (`BILLING_BLOCKCHAIN_PORT`) предоставляется глобальным
 * BlockchainModule. Подключается в корневой AppModule только при
 * BILLING_HUB_MODE=true.
 */
@Module({
  imports: [ProviderModule, DocumentDomainModule],
  providers: [
    BillingService,
    BillingResolver,
    BillingProviderClient,
    BillingCronService,
    PaymentConfirmedListener,
  ],
  exports: [BillingService],
})
export class BillingModule {}
