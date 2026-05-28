import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BillingContract } from 'cooptypes';
import { BillingProviderClient } from '~/infrastructure/billing/billing-provider.client';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';

/**
 * Listener pay-события контракта billing (Single-Hub v5).
 *
 * Парсер блокчейна (на coopback Воскхода) эмитит `action::billing::pay` для
 * каждой подтверждённой on-chain `billing::pay`. Listener извлекает
 * `payment_hash` и `transaction_id`, дёргает provider
 * `POST /billing/payment-confirmed` — provider переводит invoice в PAID и
 * продлевает подписки batch'а.
 *
 * Идемпотентно по `payment_hash` (повторный pay-event при форке /
 * cache replay → no-op на стороне provider'а).
 *
 * Listener живёт ТОЛЬКО на BILLING_HUB_MODE-узле (Воскход) — на остальных
 * узлах BillingModule не регистрируется (см. app.module.ts).
 */
@Injectable()
export class PaymentConfirmedListener {
  private readonly logger = new Logger(PaymentConfirmedListener.name);

  constructor(private readonly providerClient: BillingProviderClient) {}

  @OnEvent(`action::${BillingContract.contractName.production}::${BillingContract.Actions.Pay.actionName}`)
  async onBillingPay(action: ActionDomainInterface): Promise<void> {
    try {
      if (!this.providerClient.isConfigured()) {
        return;
      }
      const data = action.data as { payment_hash?: string } | undefined;
      const paymentHash = data?.payment_hash;
      if (!paymentHash) {
        this.logger.warn(
          `billing::pay без payment_hash в data — пропуск (tx=${action.transaction_id})`,
        );
        return;
      }
      await this.providerClient.confirmPayment({
        paymentHash,
        txId: action.transaction_id,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `confirmPayment не выполнен для tx=${action.transaction_id}: ${message}`,
      );
    }
  }
}
