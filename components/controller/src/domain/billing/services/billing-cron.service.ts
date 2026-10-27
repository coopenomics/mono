import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import cron from 'node-cron';
import config from '~/config/config';
import {
  BILLING_BLOCKCHAIN_PORT,
  type BillingBlockchainPort,
} from '~/domain/billing/ports/billing-blockchain.port';
import { BillingProviderClient, type ProviderBillingSummary, type ProviderPackageInvoice } from '~/infrastructure/billing/billing-provider.client';
import {
  CooperativeChainStatus,
  ProviderBillingInvoiceStatus,
  ProviderPackageInvoiceStatus,
  ProviderPackageInvoiceKind,
} from '~/domain/billing/enums/billing-statuses.enum';
import { BillingPaymentLogService } from '~/infrastructure/billing/billing-payment-log.service';
import { BillingPaymentLogStatus } from '~/infrastructure/billing/billing-payment-log.record';
import { ProviderService } from '~/application/provider/services/provider.service';
import { t } from '~/i18n';

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
 * Бак AXON (решение @ant 17.10.2026, «Оплата документооборота: бак AXON,
 * объём тарифа и кванты»): пополнение бака спицы тоже инициирует и подписывает
 * ОПЕРАТОР — членские взносы лежат в его леджере, спицы своими ключами
 * управляют только полученным AXON. Отдельный частый такт
 * (`billing.package_cron_expression`, по умолчанию каждые 5 минут) читает
 * баланс бака спицы и передаёт его провайдеру; тот решает: по дате оплаты
 * строки «Документооборот» — объём месяца (`monthly`, продлевает подписку),
 * при баке ниже кванта — квант 5 AXON за 50 ₽ (`quant`, cooldown у
 * провайдера), иначе NOT_DUE. Хаб проводит `billing::converttoaxn` через тот
 * же PG-журнал идемпотентности. Скорость расхода ограничена самой спицей:
 * узел жжёт бак на D в день и ещё 5 AXON при загрузке 70 %.
 */
@Injectable()
export class BillingCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BillingCronService.name);
  private cronJob: cron.ScheduledTask | null = null;
  private packageCronJob: cron.ScheduledTask | null = null;
  private running = false;
  private packagesRunning = false;

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
    if (!cron.validate(config.billing.package_cron_expression)) {
      this.logger.error(
        `BillingCronService: некорректное cron-выражение бака "${config.billing.package_cron_expression}"`,
      );
      return;
    }
    this.cronJob = cron.schedule(config.billing.cron_expression, () => {
      void this.tick();
    });
    // Бак проверяется чаще оплат: квант должен прийти раньше, чем узел сожжёт
    // запас, иначе пайщик упрётся в отказ цепи по ресурсам.
    this.packageCronJob = cron.schedule(config.billing.package_cron_expression, () => {
      void this.tickPackages();
    });
    this.logger.log(
      `BillingCronService запущен (cron="${config.billing.cron_expression}", бак="${config.billing.package_cron_expression}")`,
    );
  }

  onModuleDestroy() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    if (this.packageCronJob) {
      this.packageCronJob.stop();
      this.packageCronJob = null;
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
   * Один тик оплат: обходит активные коопы из on-chain реестра, списывает
   * подошедшие к оплате календарные подписки. Защита от наложения тиков
   * (`running`) — если предыдущий ещё идёт, пропускаем.
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
    } catch (error: any) {
      // Такт вызывается из cron через `void`: необработанный отказ становится
      // unhandledRejection, и общий обработчик гасит весь контроллер. Таймаут
      // цепи при чтении реестра коопов — штатный случай под нагрузкой узла;
      // такт пропускается, следующий повторит обход.
      this.logger.error(`BillingCronService: такт оплат пропущен: ${error?.message ?? error}`);
    } finally {
      this.running = false;
    }
  }

  /**
   * Списание сразу после пополнения кошелька членских взносов (27.10.2026):
   * ждать такта — до минуты, и всё это время пайщик видел «деньги есть, а
   * просрочка не закрыта». Идёт тем же путём, что и такт, под тем же флагом
   * наложения: если такт уже идёт, он и спишет. Отказы остаются внутри
   * processCoop — пополнение не должно падать из-за списания.
   */
  async settleCoop(coopname: string): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.processCoop(coopname);
    } finally {
      this.running = false;
    }
  }

  /**
   * Один тик бака: для каждого активного коопа читает баланс AXON и спрашивает
   * провайдера, чем пополнить бак. Свой флаг наложения — такты оплат и бака
   * идут независимо.
   */
  async tickPackages(): Promise<void> {
    if (this.packagesRunning) {
      this.logger.warn('BillingCronService: предыдущий тик бака ещё выполняется — пропуск');
      return;
    }
    this.packagesRunning = true;
    try {
      const coopnames = await this.activeCoopnames();
      for (const coopname of coopnames) {
        await this.processPackageTopup(coopname);
      }
    } catch (error: any) {
      // Как и в такте оплат: отказ не выходит за пределы такта, иначе падает контроллер.
      this.logger.error(`BillingCronService: такт бака пропущен: ${error?.message ?? error}`);
    } finally {
      this.packagesRunning = false;
    }
  }

  /**
   * Позиции счёта, подошедшие к оплате: платные подписки с наступившим сроком.
   * Пусто — платить нечего (всё free, нет подписок, срок не подошёл).
   */
  private dueItems(summary: ProviderBillingSummary | null): Array<{ subscription_id: number; period_days: number }> {
    if (!summary || summary.total_amount <= 0 || !this.isDue(summary.next_payment_due)) {
      return [];
    }
    return this.payableItems(summary);
  }

  private async processCoop(coopname: string): Promise<void> {
    try {
      const summary = await this.providerClient.getBillingSummary(coopname);
      const payableItems = this.dueItems(summary);
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
          memo: t('billing.payment.subjectPeriod', { days: summary.period_days }),
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
   * Пополнение бака AXON спицы (@ant 17.10.2026). Порядок повторяет time-поток:
   * баланс бака → provider-invoice (объём месяца по дате, квант при баке ниже
   * кванта или NOT_DUE) → PG-журнал ДО transact → on-chain `converttoaxn`
   * (подпись оператора) → подтверждение провайдеру (реактивный
   * BillingConversionListener дублирует).
   */
  private async processPackageTopup(coopname: string): Promise<void> {
    try {
      // Сначала счёт за подписки, потом бак (слово владельца 27.10.2026):
      // оба такта идут раз в минуту, и бак забирал пополнение первым — счёт
      // оставался неоплаченным, хотя кооператив внёс ровно столько, сколько
      // просил экран. Пока счёт к оплате есть, бак ждёт.
      const summary = await this.providerClient.getBillingSummary(coopname);
      if (this.dueItems(summary).length) {
        this.logger.log(`Бак ${coopname} ждёт: есть неоплаченный счёт за подписки`);
        return;
      }
      // Решает провайдер — у него тариф, дата оплаты и размер кванта. Хаб
      // передаёт ему честный сигнал: баланс бака, который узел жжёт сам.
      const balance = await this.blockchainPort.getAxonBalance(coopname);
      const invoice = await this.providerClient.createPackageInvoice(coopname, balance);
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
        invoice.subscription_type_name || t('billing.payment.packageSubject'),
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

      // i18n-ignore: запись журнала узла, не текст интерфейса
      const what = invoice.kind === ProviderPackageInvoiceKind.MONTHLY ? 'объём месяца документооборота' : 'квант сверх тарифа';
      this.logger.log(
        `Бак ${coopname} пополнен: ${what}, ${quantity} (payment_hash=${paymentHash}, AXON был ${balance})`,
      );
    } catch (error: any) {
      this.logger.error(
        `BillingCronService: пополнение бака ${coopname} не выполнено: ${error?.message ?? error}`,
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
        `Бак ${coopname} не пополнен: провайдер заблокировал (${invoice.reason ?? 'без причины'}), AXON=${balance}`,
      );
    }
    // NOT_DUE и NO_PACKAGE — молча: пополнять нечего.
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
      // Идентификатор транзакции у wharfkit лежит в ответе ноды
      // (`response.transaction_id`), а не в корне результата — канон проекта,
      // см. BlockchainService. Читая только корень, мы отправляли провайдеру
      // подтверждение с пустым tx_id: платёж проходил в цепи, а провайдер
      // отвечал 500 на уникальном индексе, и подписка не продлевалась при
      // списанных деньгах (@ant 2026-08-27).
      const raw = result as { response?: { transaction_id?: unknown }; transaction_id?: unknown } | null;
      transactionId = String(raw?.response?.transaction_id ?? raw?.transaction_id ?? '');
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

  /**
   * Позиции invoice: платные (не free, сумма > 0) с наступившим сроком, каждая
   * за свой период. Годовая подписка тарифа идёт за 365 дней и в месячный
   * батч не попадает, пока её срок не наступил; старый провайдер без этих
   * полей — как раньше, весь батч за период сводки.
   */
  private payableItems(summary: ProviderBillingSummary): Array<{ subscription_id: number; period_days: number }> {
    return (summary.items ?? [])
      .filter((item) => !item.is_free && item.amount > 0 && item.is_due !== false)
      .map((item) => ({ subscription_id: item.subscription_id, period_days: item.period_days ?? summary.period_days }));
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
      // i18n-ignore: сверка с текстом отказа контракта
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
