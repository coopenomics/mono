import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  Client as ProviderClient,
  configureClient,
  BillingService,
  SubscriptionsService,
  type BillingInvoiceCreateRequestDTO,
  type BillingInvoiceResponseDTO,
  type BillingPaymentConfirmedResponseDTO,
} from '@coopenomics/provider-client';
import config from '~/config/config';

/**
 * Позиция разбивки суммы к оплате (из provider getBillingSummary).
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
 * Ответ агрегатора «сумма к оплате» провайдера (provider /subscriptions/billing-summary).
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
 * Клиент к provider backend для биллинга подписок (Single-Hub v5).
 *
 * Использует `@coopenomics/provider-client` (auto-generated openapi-typescript-codegen
 * из provider/components/backend/swagger.json) — без сырого axios. Provider —
 * источник истины по составу/ценам подписок и по payment_hash. Доступ защищён
 * `server-secret` (ServerSecretGuard на стороне провайдера).
 */
@Injectable()
export class BillingProviderClient implements OnModuleInit {
  private readonly logger = new Logger(BillingProviderClient.name);

  private get baseUrl(): string {
    return config.provider_base_url.replace(/\/+$/, '');
  }

  onModuleInit(): void {
    if (this.baseUrl) {
      configureClient(this.baseUrl, config.server_secret);
    }
  }

  isConfigured(): boolean {
    return this.baseUrl.length > 0;
  }

  /**
   * Сумма к оплате кооператива за период (по умолчанию 30 дней). На v5 этот
   * метод используется только для UI «Сумма к оплате» / cron-уведомлений;
   * payment_hash здесь — справочный (детерминированный sha256 от состава), реальная
   * запись invoice создаётся через {@link createInvoice}.
   */
  async getBillingSummary(coopname: string, periodDays = 30): Promise<ProviderBillingSummary> {
    return (await SubscriptionsService.subscriptionControllerGetBillingSummary(
      coopname,
      String(periodDays),
    )) as unknown as ProviderBillingSummary;
  }

  /**
   * Выписать invoice на батч-оплату (POST /billing/invoice). Идемпотентно по
   * детерминированному `payment_hash` (sha256 от состава + anchor_due). Coopback
   * Воскхода вызывает перед on-chain `billing::pay`.
   */
  async createInvoice(input: BillingInvoiceCreateRequestDTO): Promise<BillingInvoiceResponseDTO> {
    const res = await BillingService.billingControllerCreateInvoice(input);
    this.logger.log(
      `createInvoice ${input.coopname} payment_hash=${res.payment_hash} status=${res.status}`,
    );
    return res;
  }

  /**
   * Подтверждение on-chain оплаты (POST /billing/payment-confirmed). Парсер
   * блокчейна Воскхода ловит pay-event, coopback Воскхода дёргает этот endpoint —
   * провайдер переводит invoice в PAID, продлевает подписки batch'а. Идемпотентно
   * по `payment_hash` (повтор → no-op).
   */
  async confirmPayment(input: {
    paymentHash: string;
    txId: string;
  }): Promise<BillingPaymentConfirmedResponseDTO> {
    const res = await BillingService.billingControllerPaymentConfirmed({
      payment_hash: input.paymentHash,
      tx_id: input.txId,
    });
    this.logger.log(
      `confirmPayment payment_hash=${input.paymentHash} applied=${res.applied} status=${res.status}`,
    );
    return res;
  }
}

// Re-export, чтобы потребитель не дублировал зависимость на provider-client
export { ProviderClient };
