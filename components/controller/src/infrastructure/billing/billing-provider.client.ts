import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import config from '~/config/config';

/**
 * Позиция разбивки суммы к оплате (из provider getBillingSummary, Story 12.5).
 */
export interface ProviderBillingSummaryItem {
  subscription_id: number;
  subscription_type_id: number;
  subscription_type_name: string;
  status: string;
  amount: number;
  is_free: boolean;
}

/**
 * Ответ агрегатора «сумма к оплате» провайдера (Story 12.5).
 */
export interface ProviderBillingSummary {
  coopname: string;
  period_days: number;
  total_amount: number;
  currency: string;
  items: ProviderBillingSummaryItem[];
  payment_hash: string;
  next_payment_due: string | null;
}

/**
 * HTTP-клиент к provider backend (Восход) для биллинга подписок (Epic 12).
 *
 * Провайдер — источник истины по составу/ценам подписок (on-chain их нет).
 * Доступ защищён `server-secret` (ServerSecretGuard на стороне провайдера).
 * `provider_base_url` и `server_secret` берутся из конфига узла.
 */
@Injectable()
export class BillingProviderClient {
  private readonly logger = new Logger(BillingProviderClient.name);

  private get baseUrl(): string {
    return config.provider_base_url.replace(/\/+$/, '');
  }

  private headers() {
    return { 'server-secret': config.server_secret };
  }

  isConfigured(): boolean {
    return this.baseUrl.length > 0;
  }

  /**
   * Сумма к оплате кооператива за период (по умолчанию 30 дней).
   */
  async getBillingSummary(coopname: string, periodDays = 30): Promise<ProviderBillingSummary> {
    const url = `${this.baseUrl}/subscriptions/billing-summary/${coopname}`;
    const { data } = await axios.get<ProviderBillingSummary>(url, {
      params: { period: periodDays },
      headers: this.headers(),
    });
    return data;
  }

  /**
   * Подтверждение проведённого on-chain платежа: провайдер фиксирует факт и
   * продлевает (`extend`) все подписки, входившие в `payment_hash`. Идемпотентно
   * по `transaction_id = payment_hash` (Epic 3 / Story 12.5).
   */
  async confirmPayment(input: {
    coopname: string;
    paymentHash: string;
    amount: number;
    blockchainTransactionId: string;
    periodDays?: number;
  }): Promise<void> {
    const url = `${this.baseUrl}/subscriptions/confirm-batch-payment`;
    await axios.post(
      url,
      {
        coopname: input.coopname,
        transaction_id: input.paymentHash,
        payment_hash: input.paymentHash,
        amount: input.amount,
        blockchain_transaction_id: input.blockchainTransactionId,
        period_days: input.periodDays ?? 30,
      },
      { headers: this.headers() },
    );
    this.logger.log(`confirmPayment ${input.coopname} payment_hash=${input.paymentHash}`);
  }

  /**
   * Epic 13 v5.1 — подтверждение on-chain `billing::topupaxon` у провайдера.
   *
   * Зеркало `confirmPayment` для пакетной модели. Вызывается на coopback'е
   * пайщика-кооператива после успешной отправки on-chain action `topupaxon`
   * (PowerupPlugin) или на coopback'е Воскхода (BILLING_HUB_MODE=true)
   * как defensive-handler, если PowerupPlugin не успел.
   *
   * Идемпотентно по `payment_hash` (провайдер сам отвечает 200 OK на повтор).
   */
  async confirmTopupAxon(input: {
    paymentHash: string;
    blockchainTransactionId: string;
  }): Promise<void> {
    const url = `${this.baseUrl}/billing/topup-axon-confirmed`;
    await axios.post(
      url,
      {
        payment_hash: input.paymentHash,
        tx_id: input.blockchainTransactionId,
      },
      { headers: this.headers() },
    );
    this.logger.log(`confirmTopupAxon payment_hash=${input.paymentHash} tx=${input.blockchainTransactionId}`);
  }
}
