import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import cron from 'node-cron';
import config from '~/config/config';
import {
  BILLING_BLOCKCHAIN_PORT,
  type BillingBlockchainPort,
} from '~/domain/billing/ports/billing-blockchain.port';
import { BillingProviderClient } from '~/infrastructure/billing/billing-provider.client';
import { ProviderService } from '~/application/provider/services/provider.service';

/**
 * Периодическое списание подписок (Epic 12, Story 12.6) — oracle-паттерн.
 *
 * Antelope не поддерживает deferred_trx, поэтому рекуррентность инициирует
 * backend: на каждый тик узел запрашивает у провайдера «сумму к оплате»
 * (источник истины по составу/ценам — provider, on-chain их нет), и если есть
 * что списывать и срок подошёл — проводит on-chain `billing::pay`, затем
 * подтверждает платёж провайдеру (тот продлевает подписки по `payment_hash`).
 *
 * Инварианты:
 * - сумма = 0 (все подписки free) → on-chain списание НЕ выполняется;
 * - идемпотентность по `payment_hash` (контракт no-op + провайдер идемпотентен);
 * - падение `pay` не зацикливает узел: ошибка логируется, тик продолжает
 *   следующий кооператив (grace/уведомления — на стороне провайдера/Epic 9).
 *
 * Плательщик (`config.billing.payer`) — пайщик, чей USER_SHARED-кошелёк
 * `w.wal.bill` дебетуется. Списание per-пайщик, поэтому без указанного
 * плательщика тик пропускается (см. конфиг `BILLING_CRON_PAYER`).
 */
@Injectable()
export class BillingCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BillingCronService.name);
  private cronJob: cron.ScheduledTask | null = null;
  private running = false;

  constructor(
    @Inject(BILLING_BLOCKCHAIN_PORT) private readonly blockchainPort: BillingBlockchainPort,
    private readonly providerClient: BillingProviderClient,
    private readonly providerService: ProviderService,
  ) {}

  onModuleInit() {
    if (!this.providerClient.isConfigured()) {
      this.logger.warn('BillingCronService: PROVIDER_BASE_URL не задан — тик не будет запущен');
      return;
    }
    if (!cron.validate(config.billing.cron_expression)) {
      this.logger.error(`BillingCronService: некорректное cron-выражение "${config.billing.cron_expression}"`);
      return;
    }
    this.cronJob = cron.schedule(config.billing.cron_expression, () => {
      void this.tick();
    });
    this.logger.log(`BillingCronService запущен (cron="${config.billing.cron_expression}")`);
  }

  onModuleDestroy() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
  }

  /**
   * Список коопов для тика берётся ИЗ on-chain `registrator.coops`
   * (через ProviderService), отфильтрованный по `status === 'active'`.
   * Никаких env-CSV — кооперативы всегда есть в блокчейне.
   */
  private async activeCoopnames(): Promise<string[]> {
    const registry = await this.providerService.getCooperativesRegistry();
    return registry.filter((c) => c.status === 'active').map((c) => c.coopname);
  }

  /**
   * Один тик: обходит активные коопы из on-chain реестра, списывает подошедшие
   * к оплате. Защита от наложения тиков (`running`) — если предыдущий ещё идёт,
   * пропускаем.
   */
  async tick(): Promise<void> {
    if (this.running) {
      this.logger.warn('BillingCronService: предыдущий тик ещё выполняется — пропуск');
      return;
    }
    const payer = config.billing.payer;
    if (!payer) {
      this.logger.warn('BillingCronService: BILLING_CRON_PAYER не задан — нечего дебетовать, пропуск тика');
      return;
    }
    this.running = true;
    try {
      const coopnames = await this.activeCoopnames();
      for (const coopname of coopnames) {
        await this.processCoop(coopname, payer);
      }
    } finally {
      this.running = false;
    }
  }

  private async processCoop(coopname: string, payer: string): Promise<void> {
    try {
      const summary = await this.providerClient.getBillingSummary(coopname);

      if (!summary || summary.total_amount <= 0) {
        return; // всё free или нет подписок — пустые транзакции не гоняем
      }
      if (!this.isDue(summary.next_payment_due)) {
        return; // срок ещё не подошёл
      }

      // v5: создаём invoice ДО pay — это фиксирует payment_hash в БД провайдера
      // (PENDING с TTL), чтобы парсер pay-event смог его подтвердить позже.
      // Идемпотентно по составу: повторный createInvoice с тем же набором подписок
      // вернёт существующую запись.
      const invoice = await this.providerClient.createInvoice({
        coopname,
        items: summary.items.map((i) => ({
          subscription_id: i.subscription_id,
          period_days: summary.period_days,
        })),
      });
      const paymentHash = invoice.payment_hash;

      const quantity = `${summary.total_amount.toFixed(config.blockchain.root_govern_precision)} ${summary.currency || config.blockchain.root_govern_symbol}`;

      await this.blockchainPort.pay({
        coopname,
        username: payer,
        quantity,
        paymentHash,
        memo: `Оплата подписок за ${summary.period_days} дн.`,
      });

      // На v5 НЕ зовём здесь confirmPayment — это сделает парсер pay-event
      // (`PaymentConfirmedHandler`), когда увидит on-chain billing::pay для
      // этого payment_hash. Так гарантируется idempotency: подтверждение
      // привязано к финальности on-chain события, а не к успеху transact().
      this.logger.log(`Подписки ${coopname}: pay submitted (payment_hash=${paymentHash}, ${quantity})`);
    } catch (error: any) {
      // Падение submit'а (например, недостаток средств на w.wal.bill) не должно
      // зацикливать узел: фиксируем и продолжаем. Перевод подписки в past_due/grace
      // и уведомления — на стороне провайдера.
      this.logger.error(`BillingCronService: списание для ${coopname} не выполнено: ${error?.message ?? error}`);
    }
  }

  /**
   * Срок оплаты подошёл, если дата следующего платежа не задана (первое списание)
   * либо она в прошлом/сегодня.
   */
  private isDue(nextPaymentDue: string | null): boolean {
    if (!nextPaymentDue) return true;
    const due = new Date(nextPaymentDue).getTime();
    if (Number.isNaN(due)) return true;
    return due <= Date.now();
  }
}
