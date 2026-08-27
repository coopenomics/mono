import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import cron from 'node-cron';
import config from '~/config/config';
import {
  BILLING_BLOCKCHAIN_PORT,
  type BillingBlockchainPort,
} from '~/domain/billing/ports/billing-blockchain.port';
import { BillingProviderClient, type ProviderBillingSummary, type ProviderPackageInvoice } from '~/infrastructure/billing/billing-provider.client';
import { CooperativeChainStatus, ProviderBillingInvoiceStatus, ProviderPackageInvoiceStatus } from '~/domain/billing/enums/billing-statuses.enum';
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
 *
 * Package-нога (Epic 13 v5.1, решение @ant 2026-06-11): докупку пакета
 * документооборота тоже инициирует и подписывает ОПЕРАТОР — членские взносы
 * лежат в его леджере, спицы своими ключами управляют только полученным AXON.
 * На каждом тике хаб читает ликвидный AXON-баланс спицы; если он ниже порога
 * (`billing.package_low_water_axon`) — просит у провайдера package-invoice
 * (тарифные guard'ы: месячная квота, cooldown — на стороне провайдера) и
 * проводит `billing::converttoaxn` через тот же PG-журнал идемпотентности.
 * Скорость расхода ограничена самой спицей (powerup её минимальной квоты),
 * потолок — месячной квотой тарифа у провайдера.
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
    return registry.filter((c) => c.status === CooperativeChainStatus.ACTIVE).map((c) => c.coopname);
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
        await this.processPackageTopup(coopname);
      }
    } finally {
      this.running = false;
    }
  }

  private async processCoop(coopname: string): Promise<void> {
    try {
      const summary = await this.providerClient.getBillingSummary(coopname);
      // всё free / нет подписок / срок не подошёл — пустые транзакции не гоняем
      if (!summary || summary.total_amount <= 0 || !this.isDue(summary.next_payment_due)) {
        return;
      }
      const payableItems = this.payableItems(summary);
      if (!payableItems.length) {
        return;
      }

      // Шаг 2: PENDING-invoice у провайдера (идемпотентно).
      const invoice = await this.providerClient.createInvoice(coopname, payableItems);
      if (invoice.status === ProviderBillingInvoiceStatus.PAID) {
        this.logger.log(`Invoice ${invoice.payment_hash} (${coopname}) уже PAID — пропуск`);
        return;
      }

      const quantity = `${invoice.total_amount.toFixed(config.blockchain.root_govern_precision)} ${summary.currency || config.blockchain.root_govern_symbol}`;

      // Шаг 3: журнал платежей (PG хаба) ДО transact — единственный источник
      // идемпотентности: контракт on-chain таблиц не ведёт (RAM чейна на
      // платежи не тратится, решение @ant 2026-06-11). Существующая запись
      // блокирует повторное списание при любом сценарии.
      const begin = await this.paymentLog.begin(
        invoice.payment_hash,
        coopname,
        quantity,
        this.describeItems(summary, payableItems),
      );
      if (!begin.started) {
        await this.handleExistingPayment(coopname, invoice.payment_hash, begin.existing?.status, begin.existing?.tx_id);
        return;
      }

      // Шаг 4: on-chain списание. Подписывает оператор (аккаунт узла-хаба);
      // username — пайщик-кооператив, владелец биллинг-кошелька.
      // coopname контракта = кооператив-оператор (его леджер: w.wal.bill —
      // USER_SHARED с L3-разрезом по пайщику, решение @ant 2026-06-11).
      const transactionId = await this.submitToChain(invoice.payment_hash, () =>
        this.blockchainPort.pay({
          coopname: config.coopname,
          username: coopname,
          quantity,
          paymentHash: invoice.payment_hash,
          memo: `Оплата подписок за ${summary.period_days} дн.`,
        }),
      );

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
   * Package-нога тика (Epic 13 v5.1): докупка пакета документооборота за
   * кооператив-спицу. Порядок повторяет time-поток: provider-invoice →
   * PG-журнал ДО transact → on-chain `converttoaxn` (подпись оператора) →
   * подтверждение провайдеру (реактивный BillingConversionListener дублирует).
   */
  private async processPackageTopup(coopname: string): Promise<void> {
    try {
      // Триггер — исчерпание ликвидного AXON у спицы. Расход AXON контролирует
      // сама спица (powerup минимальной квоты), поэтому баланс — честный сигнал.
      const balance = await this.blockchainPort.getAxonBalance(coopname);
      if (balance >= config.billing.package_low_water_axon) {
        return;
      }

      // Тарифные guard'ы (квота месяца, cooldown, наличие package-подписки) —
      // у провайдера; при BLOCKED он сам уведомляет кооператив.
      const invoice = await this.providerClient.createPackageInvoice(coopname);
      if (!this.isPendingPackageInvoice(invoice, coopname, balance)) {
        return;
      }
      const paymentHash = invoice.payment_hash;
      const amountRub = invoice.total_amount;
      const quantity = `${amountRub.toFixed(config.blockchain.root_govern_precision)} ${config.blockchain.root_govern_symbol}`;

      // Журнал платежей ДО transact — та же идемпотентность, что и в pay-потоке.
      const begin = await this.paymentLog.begin(
        paymentHash,
        coopname,
        quantity,
        invoice.subscription_type_name || 'Пакет документооборота',
      );
      if (!begin.started) {
        await this.handleExistingPackageTopup(coopname, paymentHash, amountRub, begin.existing?.status, begin.existing?.tx_id);
        return;
      }

      const transactionId = await this.submitToChain(paymentHash, () =>
        this.blockchainPort.convertToAxn({ username: coopname, quantity, paymentHash }),
      );

      await this.providerClient.confirmTopupAxon({
        paymentHash,
        blockchainTransactionId: transactionId,
        coopname,
        amountRub,
      });
      await this.paymentLog.markConfirmed(paymentHash);

      this.logger.log(
        `Докуплен пакет документооборота для ${coopname}: ${quantity} (payment_hash=${paymentHash}, AXON был ${balance})`,
      );
    } catch (error: any) {
      this.logger.error(
        `BillingCronService: докупка пакета для ${coopname} не выполнена: ${error?.message ?? error}`,
      );
    }
  }

  /**
   * PENDING с payment_hash и суммой — можно конвертировать. BLOCKED логируем
   * (уведомление кооперативу шлёт провайдер), NO_PACKAGE — молча.
   */
  private isPendingPackageInvoice(
    invoice: ProviderPackageInvoice,
    coopname: string,
    balance: number,
  ): invoice is ProviderPackageInvoice & { payment_hash: string; total_amount: number } {
    if (invoice.status === ProviderPackageInvoiceStatus.PENDING && invoice.payment_hash && invoice.total_amount) {
      return true;
    }
    if (invoice.status === ProviderPackageInvoiceStatus.BLOCKED) {
      this.logger.warn(
        `Пакет для ${coopname} не докуплен: провайдер заблокировал (${invoice.reason ?? 'без причины'}), AXON=${balance}`,
      );
    }
    return false;
  }

  /**
   * Package-аналог handleExistingPayment: SUBMITTED — доносим подтверждение
   * провайдеру; SUBMITTING — нет автоповтора (доведёт листенер парсера).
   */
  private async handleExistingPackageTopup(
    coopname: string,
    paymentHash: string,
    amountRub: number,
    status?: BillingPaymentLogStatus,
    txId?: string | null,
  ): Promise<void> {
    if (status === BillingPaymentLogStatus.SUBMITTED) {
      this.logger.warn(
        `billing::converttoaxn ${coopname}: payment_hash=${paymentHash} уже отправлен (tx=${txId ?? '?'}) — доношу подтверждение провайдеру`,
      );
      await this.providerClient.confirmTopupAxon({
        paymentHash,
        blockchainTransactionId: txId ?? '',
        coopname,
        amountRub,
      });
      await this.paymentLog.markConfirmed(paymentHash);
      return;
    }
    this.logger.warn(
      `billing::converttoaxn ${coopname}: payment_hash=${paymentHash} уже в журнале (status=${status ?? '?'}) — повторная докупка заблокирована` +
        (status === BillingPaymentLogStatus.SUBMITTING
          ? '; запись зависла в SUBMITTING — нужна сверка с историей чейна, автоповтора не будет'
          : ''),
    );
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
  /**
   * Общий шаг «транзакция под журналом» для pay и converttoaxn: отправить,
   * при доменном отказе — FAILED (деньги не списаны, повтор безопасен), при
   * сетевой ошибке — ERROR с записью в SUBMITTING (tx могла пройти, доведёт
   * листенер парсера); при успехе — SUBMITTED с tx_id.
   */
  private async submitToChain(paymentHash: string, send: () => Promise<unknown>): Promise<string> {
    let transactionId = '';
    try {
      const result = await send();
      transactionId =
        result && typeof result === 'object' && 'transaction_id' in result
          ? String((result as { transaction_id?: unknown }).transaction_id ?? '')
          : '';
    } catch (error: any) {
      const message = String(error?.message ?? error);
      if (this.isDomainRejection(error)) {
        await this.paymentLog.markFailed(paymentHash, message);
      } else {
        await this.paymentLog.recordError(paymentHash, message);
      }
      throw error;
    }
    await this.paymentLog.markSubmitted(paymentHash, transactionId);
    return transactionId;
  }

  /**
   * За что списание — человеческим текстом для журнала. Состав знает только
   * провайдер (в сводке лежат имена услуг), а в истории у пайщика без него
   * видна одна сумма без объяснения.
   */
  private describeItems(
    summary: ProviderBillingSummary,
    payableItems: Array<{ subscription_id: number; period_days: number }>,
  ): string {
    const ids = new Set(payableItems.map((i) => i.subscription_id));
    const names = (summary.items ?? [])
      .filter((item) => ids.has(item.subscription_id))
      .map((item) => item.subscription_type_name)
      .filter((name): name is string => Boolean(name));
    // Дублей быть не должно, но одна услуга дважды в списке выглядит как ошибка.
    return [...new Set(names)].join(', ');
  }

  /** Позиции invoice: только платные (не free, сумма > 0). */
  private payableItems(summary: ProviderBillingSummary): Array<{ subscription_id: number; period_days: number }> {
    return (summary.items ?? [])
      .filter((item) => !item.is_free && item.amount > 0)
      .map((item) => ({ subscription_id: item.subscription_id, period_days: summary.period_days }));
  }

  /**
   * Отказ, после которого транзакции в блоке ТОЧНО нет, — значит повтор
   * безопасен и запись журнала помечается FAILED (следующий тик её подхватит).
   * Всё остальное (обрыв связи, таймаут ожидания ответа) оставляет SUBMITTING:
   * там транзакция могла пройти, и автоповтор списал бы дважды.
   *
   * Кроме assert'ов контракта сюда входят отказы САМОЙ ноды по ресурсам и
   * сроку: превышение лимита CPU/NET и протухший срок — это не «сбой связи»,
   * транзакция отвергнута детерминированно. Пока они считались сетевыми,
   * запись навсегда застревала в SUBMITTING: автоповтора у неё нет, а
   * payment_hash тот же — кооператив оставался без списания и после пополнения
   * кошелька (поймано на стенде 2026-08-27: `was executing for too long ...
   * reached on chain max_transaction_cpu_usage`).
   */
  private isDomainRejection(error: any): boolean {
    const message = String(error?.message ?? error ?? '');
    // Дубль — обратный случай: транзакция уже принята цепью, повторять нельзя.
    if (/duplicate transaction/i.test(message)) return false;
    return (
      message.includes('assertion failure') ||
      message.includes('eosio_assert') ||
      message.includes('недостаточно') ||
      /executing for too long|max_transaction_cpu_usage|tx_cpu_usage_exceeded/i.test(message) ||
      /tx_net_usage_exceeded|transaction (was )?too large/i.test(message) ||
      /expired transaction|transaction expired/i.test(message)
    );
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
