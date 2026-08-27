import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import config from '~/config/config';
import {
  ProviderBillingInvoiceStatus,
  ProviderPackageInvoiceStatus,
  ProviderSubscriptionStatus,
} from '~/domain/billing/enums/billing-statuses.enum';

/**
 * Позиция разбивки суммы к оплате (из provider getBillingSummary, Story 12.5).
 */
export interface ProviderBillingSummaryItem {
  subscription_id: number;
  subscription_type_id: number;
  subscription_type_name: string;
  status: ProviderSubscriptionStatus;
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
 * Invoice на батч-оплату подписок (Single-Hub v5, POST /billing/invoice).
 * `payment_hash` провайдер считает детерминированно; повторный запрос с теми же
 * позициями возвращает существующий PENDING-invoice. `status === 'PAID'` —
 * платить нечего (оплата уже зафиксирована ранее).
 */
export interface ProviderBillingInvoice {
  payment_hash: string;
  coopname: string;
  total_amount: number;
  status: ProviderBillingInvoiceStatus;
  expires_at: string;
}

/**
 * Ответ POST /billing/package-invoice (Epic 13 v5.1, hub-инициированная докупка).
 * `PENDING` — invoice выписан (или возвращён существующий), можно конвертировать;
 * `BLOCKED` — провайдер отказал по тарифным guard'ам (`reason`: quota_exceeded /
 * cooldown), уведомление кооперативу шлёт сам провайдер;
 * `NO_PACKAGE` — у кооператива нет активной package-подписки.
 */
export interface ProviderPackageInvoice {
  status: ProviderPackageInvoiceStatus;
  reason?: string | null;
  payment_hash?: string;
  coopname?: string;
  total_amount?: number;
  expires_at?: string;
  /** Название услуги — попадает в журнал списаний, чтобы в истории было видно, за что списано. */
  subscription_type_name?: string;
}

/**
 * HTTP-клиент к provider backend (Восход) для биллинга подписок
 * (Epic 12/13, проект «Облачный провайдер»).
 *
 * Провайдер — источник истины по составу/ценам подписок (on-chain их нет).
 * Доступ защищён `server-secret` (ServerSecretGuard на стороне провайдера).
 * `provider_base_url` и `server_secret` берутся из конфига узла.
 *
 * TODO(Epic 13): перейти на генерируемый `@coopenomics/provider-client`.
 * Текущая опубликованная версия (alpha 2025.11) — ДО Epic 12/13: в ней нет
 * billing-эндпоинтов (`/billing/topup-axon-confirmed`, `/subscriptions/billing-summary`).
 * Миграция требует regen+publish клиента из актуального provider swagger —
 * отдельная задача; пока ручной axios.
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
   * Выписать invoice на батч-оплату подписок (Single-Hub v5).
   *
   * Вызывается ПЕРЕД on-chain `billing::pay`: провайдер фиксирует PENDING-invoice
   * с TTL и отдаёт детерминированный `payment_hash`, который уходит в чейн.
   * Без этого шага `POST /billing/payment-confirmed` не найдёт invoice и оплата
   * не продлит подписки. Идемпотентно: повтор с теми же позициями возвращает
   * существующий invoice.
   */
  async createInvoice(
    coopname: string,
    items: Array<{ subscription_id: number; period_days: number }>,
  ): Promise<ProviderBillingInvoice> {
    const url = `${this.baseUrl}/billing/invoice`;
    const { data } = await axios.post<ProviderBillingInvoice>(
      url,
      { coopname, items },
      { headers: this.headers(), timeout: 10_000 },
    );
    this.logger.log(`createInvoice ${coopname} payment_hash=${data.payment_hash} status=${data.status}`);
    return data;
  }

  /**
   * Выписать package-invoice на докупку пакета документооборота (Epic 13 v5.1).
   *
   * Вызывается hub-cron'ом ПЕРЕД on-chain `billing::converttoaxn`, когда
   * ликвидный AXON-баланс спицы упал ниже порога. Тарифные guard'ы (месячная
   * квота, cooldown) — на стороне провайдера: при отказе он возвращает BLOCKED
   * и сам уведомляет кооператив («квота исчерпана — поднимите лимит»).
   * Идемпотентно: повтор при неоплаченном PENDING возвращает тот же invoice.
   */
  async createPackageInvoice(coopname: string): Promise<ProviderPackageInvoice> {
    const url = `${this.baseUrl}/billing/package-invoice`;
    const { data } = await axios.post<ProviderPackageInvoice>(
      url,
      { coopname },
      { headers: this.headers(), timeout: 10_000 },
    );
    this.logger.log(
      `createPackageInvoice ${coopname} status=${data.status}` +
        (data.payment_hash ? ` payment_hash=${data.payment_hash}` : '') +
        (data.reason ? ` reason=${data.reason}` : ''),
    );
    return data;
  }

  /**
   * Подтверждение проведённого on-chain платежа (Single-Hub v5): провайдер
   * переводит invoice в PAID и продлевает (`extend`) все входившие в него
   * подписки. Идемпотентно по `payment_hash` (повтор → no-op), поэтому зовётся
   * с двух сторон: синхронно из BillingCronService сразу после transact и
   * реактивно из BillingPaymentListener по событию парсера.
   */
  async confirmPayment(input: { paymentHash: string; blockchainTransactionId: string }): Promise<void> {
    const url = `${this.baseUrl}/billing/payment-confirmed`;
    await axios.post(
      url,
      {
        payment_hash: input.paymentHash,
        tx_id: input.blockchainTransactionId,
      },
      { headers: this.headers(), timeout: 10_000 },
    );
    this.logger.log(`confirmPayment payment_hash=${input.paymentHash} tx=${input.blockchainTransactionId}`);
  }

  /**
   * Epic 13 v5.1 — реактивное уведомление провайдера об on-chain
   * `billing::converttoaxn` (членский взнос → AXON, бездокументарно).
   *
   * Вызывается на coopback'е Воскхода (BILLING_HUB_MODE=true) из
   * BillingConversionListener, который ловит событие шины
   * `action::billing::converttoaxn` (через парсер блокчейна). Провайдер по
   * `payment_hash` находит/реактивно заводит package-invoice и фиксирует факт —
   * invoice заранее НЕ создаётся, PowerupPlugin считает `payment_hash` автономно.
   * Поэтому передаём `coopname` + `amount_rub` — провайдеру нужно по какой
   * подписке списать пакетную квоту.
   *
   * Идемпотентно по `payment_hash` (провайдер сам отвечает 200 OK на повтор).
   */
  async confirmTopupAxon(input: {
    paymentHash: string;
    blockchainTransactionId: string;
    coopname: string;
    amountRub: number;
  }): Promise<void> {
    const url = `${this.baseUrl}/billing/topup-axon-confirmed`;
    await axios.post(
      url,
      {
        payment_hash: input.paymentHash,
        tx_id: input.blockchainTransactionId,
        coopname: input.coopname,
        amount_rub: input.amountRub,
      },
      { headers: this.headers(), timeout: 10_000 },
    );
    this.logger.log(
      `confirmTopupAxon coop=${input.coopname} payment_hash=${input.paymentHash} tx=${input.blockchainTransactionId} amount_rub=${input.amountRub}`,
    );
  }
}
