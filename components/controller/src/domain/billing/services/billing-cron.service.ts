import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import cron from 'node-cron';
import config from '~/config/config';
import {
  BILLING_BLOCKCHAIN_PORT,
  type BillingBlockchainPort,
} from '~/domain/billing/ports/billing-blockchain.port';
import { BillingProviderClient } from '~/infrastructure/billing/billing-provider.client';
import { BillingPaymentLogService } from '~/infrastructure/billing/billing-payment-log.service';
import { BillingPaymentLogStatus } from '~/infrastructure/billing/entities/billing-payment-log.entity';
import { ProviderService } from '~/application/provider/services/provider.service';

/**
 * Периодическое списание подписок (Epic 12, Single-Hub v5) — oracle-паттерн.
 *
 * Antelope не поддерживает deferred_trx, поэтому рекуррентность инициирует
 * backend Восхода. Полный цикл на каждый кооператив:
 *
 *   1. GET /subscriptions/billing-summary — сумма к оплате и срок (источник
 *      истины по составу/ценам — provider, on-chain их нет);
 *   2. POST /billing/invoice — провайдер фиксирует PENDING-invoice и отдаёт
 *      детерминированный `payment_hash`. БЕЗ этого шага подтверждение оплаты
 *      не найдёт invoice и подписки не продлятся;
 *   3. запись в журнал платежей (PG хаба, BillingPaymentLogService) ДО
 *      transact — единственный источник идемпотентности: контракт on-chain
 *      таблиц не ведёт (RAM чейна на платежи не тратится, решение @ant
 *      2026-06-11). Существующая запись блокирует повторное списание при
 *      любом сценарии: зависший парсер, упавший backend, наложение тиков;
 *   4. on-chain `billing::pay` — подписывает ОПЕРАТОР (`_provider`, аккаунт
 *      узла-хаба);
 *   5. POST /billing/payment-confirmed — провайдер переводит invoice в PAID и
 *      продлевает подписки. Идемпотентно; этот же callback реактивно шлёт
 *      BillingPaymentListener по событию парсера — упавший между шагами 4-5
 *      backend не теряет оплату.
 *
 * Инварианты:
 * - сумма = 0 (все подписки free) → on-chain списание НЕ выполняется;
 * - падение `pay` не зацикливает узел: ошибка логируется, тик продолжает
 *   следующий кооператив (grace/уведомления — на стороне провайдера).
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
    private readonly paymentLog: BillingPaymentLogService,
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
    this.running = true;
    try {
      const coopnames = await this.activeCoopnames();
      for (const coopname of coopnames) {
        await this.processCoop(coopname);
      }
    } finally {
      this.running = false;
    }
  }

  private async processCoop(coopname: string): Promise<void> {
    try {
      const summary = await this.providerClient.getBillingSummary(coopname);

      if (!summary || summary.total_amount <= 0) {
        return; // всё free или нет подписок — пустые транзакции не гоняем
      }
      if (!this.isDue(summary.next_payment_due)) {
        return; // срок ещё не подошёл
      }

      const payableItems = (summary.items ?? [])
        .filter((item) => !item.is_free && item.amount > 0)
        .map((item) => ({ subscription_id: item.subscription_id, period_days: summary.period_days }));
      if (!payableItems.length) {
        return;
      }

      // Шаг 2: PENDING-invoice у провайдера (идемпотентно).
      const invoice = await this.providerClient.createInvoice(coopname, payableItems);
      if (invoice.status === 'PAID') {
        this.logger.log(`Invoice ${invoice.payment_hash} (${coopname}) уже PAID — пропуск`);
        return;
      }

      const quantity = `${invoice.total_amount.toFixed(config.blockchain.root_govern_precision)} ${summary.currency || config.blockchain.root_govern_symbol}`;

      // Шаг 3: журнал платежей (PG хаба) ДО transact — единственный источник
      // идемпотентности: контракт on-chain таблиц не ведёт (RAM чейна на
      // платежи не тратится, решение @ant 2026-06-11). Существующая запись
      // блокирует повторное списание при любом сценарии.
      const begin = await this.paymentLog.begin(invoice.payment_hash, coopname, quantity);
      if (!begin.started) {
        await this.handleExistingPayment(coopname, invoice.payment_hash, begin.existing?.status, begin.existing?.tx_id);
        return;
      }

      // Шаг 4: on-chain списание. Подписывает оператор (аккаунт узла-хаба);
      // username — пайщик-кооператив, владелец биллинг-кошелька.
      // coopname контракта = кооператив-оператор (его леджер: w.wal.bill —
      // USER_SHARED с L3-разрезом по пайщику, решение @ant 2026-06-11).
      let transactionId = '';
      try {
        const result = await this.blockchainPort.pay({
          coopname: config.coopname,
          username: coopname,
          quantity,
          paymentHash: invoice.payment_hash,
          memo: `Оплата подписок за ${summary.period_days} дн.`,
        });
        transactionId =
          result && typeof result === 'object' && 'transaction_id' in result
            ? String((result as { transaction_id?: unknown }).transaction_id ?? '')
            : '';
      } catch (error: any) {
        if (this.isDomainRejection(error)) {
          // Нода отклонила транзакцию по делу (assert контракта, нехватка
          // средств) — деньги не списаны, повтор в следующий тик безопасен.
          await this.paymentLog.markFailed(invoice.payment_hash, String(error?.message ?? error));
        } else {
          // Сетевая ошибка/timeout: транзакция МОГЛА пройти. Запись остаётся
          // SUBMITTING — автоповтор заблокирован; если pay попал в блок,
          // реактивный листенер парсера доведёт запись до CONFIRMED.
          await this.paymentLog.recordError(invoice.payment_hash, String(error?.message ?? error));
        }
        throw error;
      }
      await this.paymentLog.markSubmitted(invoice.payment_hash, transactionId);

      // Шаг 5: синхронное подтверждение (реактивный BillingPaymentListener
      // продублирует — провайдер идемпотентен по payment_hash).
      await this.providerClient.confirmPayment({
        paymentHash: invoice.payment_hash,
        blockchainTransactionId: transactionId,
      });
      await this.paymentLog.markConfirmed(invoice.payment_hash);

      this.logger.log(`Списано ${quantity} за подписки ${coopname} (payment_hash=${invoice.payment_hash})`);
    } catch (error: any) {
      // Падение списания (например, недостаток средств на w.wal.bill) не должно
      // зацикливать узел: фиксируем и продолжаем. Перевод подписки в past_due/grace
      // и уведомления — на стороне провайдера (Epic 4/14).
      this.logger.error(`BillingCronService: списание для ${coopname} не выполнено: ${error?.message ?? error}`);
    }
  }

  /**
   * Запись по payment_hash уже есть в журнале — повторного списания не будет.
   * SUBMITTED — доносим подтверждение провайдеру; SUBMITTING — платёж в полёте
   * либо завис в crash-окне (нужна сверка с историей чейна, НЕ автоповтор);
   * CONFIRMED — гонка с PENDING-invoice, подтверждение уже было.
   */
  private async handleExistingPayment(
    coopname: string,
    paymentHash: string,
    status?: BillingPaymentLogStatus,
    txId?: string | null,
  ): Promise<void> {
    if (status === BillingPaymentLogStatus.SUBMITTED) {
      this.logger.warn(
        `billing::pay ${coopname}: payment_hash=${paymentHash} уже отправлен (tx=${txId ?? '?'}) — доношу подтверждение провайдеру`,
      );
      await this.providerClient.confirmPayment({
        paymentHash,
        blockchainTransactionId: txId ?? '',
      });
      await this.paymentLog.markConfirmed(paymentHash);
      return;
    }
    this.logger.warn(
      `billing::pay ${coopname}: payment_hash=${paymentHash} уже в журнале (status=${status ?? '?'}) — повторное списание заблокировано` +
        (status === BillingPaymentLogStatus.SUBMITTING
          ? '; запись зависла в SUBMITTING — нужна сверка с историей чейна, автоповтора не будет'
          : ''),
    );
  }

  /** Доменный отказ ноды (assert контракта / walletop): транзакция точно не прошла. */
  private isDomainRejection(error: any): boolean {
    const message = String(error?.message ?? error ?? '');
    return message.includes('assertion failure') || message.includes('eosio_assert') || message.includes('недостаточно');
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
