import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { MarketContract } from 'cooptypes';
import {
  LOGGER_PORT,
  PAYMENT_DESK_PORT,
  PaymentStatus,
  type ILoggerPort,
  type InnerChainActionRecord,
  type InnerChainDelta,
  type InnerPaymentMethod,
  type IPaymentDeskPort,
} from '@coopenomics/innercoop';
import { chainRefusalOf, isStandWorkerTurn, platformSettings } from '@coopenomics/extension-kit';
import {
  MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY,
  type MarketplaceOutgoingPaymentRequestDomainRepository,
} from '../../domain/repositories/marketplace-outgoing-payment-request.repository';
import type { MarketplaceOutgoingPaymentRequestDomainEntity } from '../../domain/entities/marketplace-outgoing-payment-request.entity';
import {
  MarketplacePayoutChainStatuses,
  PAYOUT_STATUS_BY_CHAIN,
} from '../../domain/entities/marketplace-outgoing-payment-request.types';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import { MarketplaceOrderPayoutStatuses } from '../../domain/entities/marketplace-order.types';
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import { MARKETPLACE_ASSET_CONFIG, type MarketplaceAssetConfig } from './marketplace-asset.config';
import {
  MARKETPLACE_SUPPLIER_SETTINGS_SERVICE,
  MarketplaceSupplierSettingsService,
} from './marketplace-supplier-settings.service';
import {
  MARKETPLACE_SUPPLIER_REGISTRY_SERVICE,
  MarketplaceSupplierRegistryService,
} from './marketplace-supplier-registry.service';
import {
  MARKETPLACE_CASHIER_NEW_PAYMENT_EVENT,
  MARKETPLACE_SUPPLIER_PAYMENT_CONFIRMED_EVENT,
  MARKETPLACE_SUPPLIER_PAYMENT_DECLINED_EVENT,
  type MarketplaceCashierNewPaymentEvent,
  type MarketplaceSupplierPaymentConfirmedEvent,
  type MarketplaceSupplierPaymentDeclinedEvent,
} from '../events/marketplace-notification.events';
import { formatPayoutDestination } from '../shared/payout-destination.util';
import {
  PAYOUT_ACTIONS_PER_TRANSACTION,
  chunk,
  newPayoutHash,
  ordersDative,
  payoutDayStart,
} from '../shared/payout-batch.util';
import { t } from '../../i18n';

/** Шаг обхода в работе — час: первый обход после полуночи объединяет вчерашние заказы в пакеты. */
const PAYOUT_PACE_SECONDS = 60 * 60;

/** Наименований имущества в уведомлении поставщику; остальное — «и ещё N». */
const ITEM_NAMES_IN_NOTICE = 3;

/**
 * Пакет выплаты поставщику (решение владельца 19.11.2026).
 *
 * Пайщики заказывают у одного поставщика помногу, и выплата на каждый заказ
 * давала кассиру десятки платежей одному получателю с одним назначением по
 * договору. Обход в конце суток объединяет принятые и ещё не оплаченные заказы
 * поставщика в один пакет — один платёж кассиру:
 *
 *   1. запись пакета (OPEN) с заказами и назначением по договору поставщика;
 *   2. `addpayout` на каждый заказ — сумму пакета и удержание гарантийного
 *      долга считает контракт, узел берёт их из дельты таблицы `payouts`;
 *   3. `sendpayout` — один исходящий платёж в gateway, сумма больше не
 *      меняется; платёж в реестре кассира и задача кассиру;
 *   4. подтверждение кассира (`payconfirm`) — заказы пакета закрываются
 *      (`closepayout`, Дт 76 / Кт 51 на заказ), поставщику уведомление;
 *   5. отказ кассира (`paydecline`) — заказы возвращаются в ожидание выплаты
 *      (`releasepay`) и попадают в пакет следующих суток.
 *
 * Отсечка суток: в пакет попадают заказы, принятые (или возвращённые после
 * отказа) до начала текущих суток. В работе сутки — по поясу кооператива, на
 * стенде — длиной `STAND_DAY_SECONDS`. Каждый шаг идемпотентен: сбой любого
 * шага довозит следующий обход по состоянию пакета.
 *
 * Что отправлять и что удалять, решает строка пакета в цепи, а не зеркало
 * узла: разбор блоков может отставать от транзакции, и решение по отставшему
 * зеркалу оставило бы в цепи пакет, о котором узел не знает.
 */
@Injectable()
export class MarketplaceSupplierPayoutService {
  /** Обход идёт один: пересекающиеся обходы включали бы одни заказы дважды. */
  private running = false;
  /** Пакеты, которые сейчас закрываются или возвращаются, — не трогать параллельно. */
  private readonly busy = new Set<string>();

  constructor(
    @Inject(MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY)
    private readonly paymentRepo: MarketplaceOutgoingPaymentRequestDomainRepository,
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly offerRepo: MarketplaceOfferDomainRepository,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(PAYMENT_DESK_PORT)
    private readonly coreGateway: IPaymentDeskPort,
    @Inject(MARKETPLACE_SUPPLIER_SETTINGS_SERVICE)
    private readonly supplierSettings: MarketplaceSupplierSettingsService,
    @Inject(MARKETPLACE_SUPPLIER_REGISTRY_SERVICE)
    private readonly supplierRegistry: MarketplaceSupplierRegistryService,
    @Inject(MARKETPLACE_ASSET_CONFIG)
    private readonly assetConfig: MarketplaceAssetConfig,
    private readonly eventBus: EventEmitter2,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceSupplierPayoutService.name);
  }

  // ── Обход ────────────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    if (!isStandWorkerTurn(PAYOUT_PACE_SECONDS)) return;
    await this.run(platformSettings().coopname, new Date());
  }

  /** Довоз начатых пакетов и новые пакеты по заказам до начала текущих суток. */
  async run(coopname: string, now: Date): Promise<{ created: number }> {
    if (this.running) return { created: 0 };
    this.running = true;
    try {
      await this.resume(coopname);
      return { created: await this.createBatches(coopname, now) };
    } catch (err: any) {
      this.logger.warn(`[PAYOUT] обход выплат поставщикам упал: ${err.message}`);
      return { created: 0 };
    } finally {
      this.running = false;
    }
  }

  /** Новые пакеты: по одному на поставщика, у которого нет открытого пакета. */
  private async createBatches(coopname: string, now: Date): Promise<number> {
    const cutoff = payoutDayStart(now, platformSettings().timezone || 'UTC');
    const awaiting = await this.orderRepo.listAwaitingSupplierPayout(coopname, cutoff);
    if (!awaiting.length) return 0;

    // Открытые пакеты — среди незакрытых: их выборка идёт по индексу, история выплат не читается.
    const unsettled = await this.paymentRepo.listUnsettled(coopname);
    const busyPayees = new Set(unsettled.filter((p) => p.is_open).map((p) => p.payee_account));

    const byPayee = new Map<string, MarketplaceOrderDomainEntity[]>();
    for (const order of awaiting) {
      if (busyPayees.has(order.supplier_account)) continue;
      const list = byPayee.get(order.supplier_account) ?? [];
      list.push(order);
      byPayee.set(order.supplier_account, list);
    }

    let created = 0;
    for (const [payee, orders] of byPayee) {
      if (await this.createBatch(coopname, payee, orders, cutoff)) created++;
    }
    return created;
  }

  private async createBatch(
    coopname: string,
    payee: string,
    orders: MarketplaceOrderDomainEntity[],
    cutoff: Date
  ): Promise<boolean> {
    const payoutMethod = await this.resolvePayoutMethod(coopname, payee);
    const projection = await this.paymentRepo.create({
      coopname,
      payment_hash: newPayoutHash(coopname, payee, cutoff),
      lines: orders.map((o) => ({ order_id: o.id, order_hash: o.order_hash })),
      payee_account: payee,
      symbol: this.assetConfig.symbol,
      purpose: await this.buildPurpose(coopname, payee),
      payout_destination: payoutMethod ? formatPayoutDestination(payoutMethod) : null,
    });

    // Сбой не роняет пакет: включённые заказы остаются в открытом пакете,
    // остальные попадут в пакет следующего обхода.
    const sent = await this.sendInParts(
      orders.map((o) => o.order_hash),
      (hashes) => this.chainPort.addPayouts(coopname, projection.payment_hash, hashes),
      // i18n-ignore: подпись шага в журнале узла — текст для оператора, не для пайщика
      `включение в пакет ${projection.payment_hash} поставщика ${payee}`
    );
    if (sent.accepted === 0 && !sent.uncertain) {
      // Контракт отклонил каждую транзакцию — пакета в цепи нет наверняка.
      // После сбоя связи исход транзакции неизвестен: запись остаётся, решит цепь.
      await this.paymentRepo.deleteByPaymentHash(coopname, projection.payment_hash);
      this.logger.warn(`[PAYOUT] пакет ${projection.payment_hash} поставщика ${payee}: цепь не включила ни одного заказа — запись удалена.`);
      return false;
    }
    await this.finishOpen(projection.coopname, projection.payment_hash, payoutMethod, { fresh: true });
    return true;
  }

  /**
   * Действия по заказам пакета — частями по транзакции. Транзакция атомарна:
   * отказ контракта по одному заказу отклоняет всю часть, и один заказ держал
   * бы выплату по остальным заказам поставщика. Поэтому после отказа контракта
   * заказы части отправляются по одному. Сбой связи с цепью обход прекращает —
   * довезёт следующий; исход такой транзакции неизвестен (`uncertain`): цепь
   * могла её принять. `accepted` — число заказов, действие по которым цепь приняла.
   */
  private async sendInParts(
    order_hashes: string[],
    send: (order_hashes: string[]) => Promise<unknown>,
    label: string
  ): Promise<{ accepted: number; uncertain: boolean }> {
    let accepted = 0;
    const attempt = async (part: string[]): Promise<'accepted' | 'refused' | 'uncertain'> => {
      try {
        await send(part);
        accepted += part.length;
        return 'accepted';
      } catch (err: any) {
        if (!isChainRefusal(err)) {
          this.logger.warn(`[PAYOUT] ${label}: цепь недоступна (${err.message}); довезёт следующий обход.`);
          return 'uncertain';
        }
        this.logger.warn(
          part.length === 1
            ? `[PAYOUT] ${label}: заказ ${part[0]} отклонён контрактом: ${err.message}`
            : `[PAYOUT] ${label}: часть из ${part.length} заказов отклонена контрактом (${err.message}); заказы отправляются по одному.`
        );
        return 'refused';
      }
    };

    for (const part of chunk(order_hashes, PAYOUT_ACTIONS_PER_TRANSACTION)) {
      const outcome = await attempt(part);
      if (outcome === 'uncertain') return { accepted, uncertain: true };
      if (outcome === 'accepted' || part.length === 1) continue;
      for (const order_hash of part) {
        if ((await attempt([order_hash])) === 'uncertain') return { accepted, uncertain: true };
      }
    }
    return { accepted, uncertain: false };
  }

  /**
   * Довоз начатых пакетов: открытый — отправить кассиру, отправленный без
   * платежа в реестре — завести платёж, оплаченный — закрыть заказы,
   * отклонённый — вернуть заказы.
   */
  async resume(coopname: string): Promise<void> {
    const unsettled = await this.paymentRepo.listUnsettled(coopname);
    for (const projection of unsettled) {
      try {
        if (projection.is_open) {
          await this.finishOpen(coopname, projection.payment_hash, null, { fresh: false });
        } else if (projection.is_pending) {
          if (!projection.core_payment_id) await this.createCorePayment(projection, null);
        } else if (projection.is_completed) {
          await this.closeOrders(projection);
        } else if (projection.is_declined) {
          await this.releaseOrders(projection);
        }
      } catch (err: any) {
        this.logger.warn(`[PAYOUT] довоз пакета ${projection.payment_hash} упал: ${err.message}`);
      }
    }
  }

  /**
   * Открытый пакет после включения заказов. Решает строка пакета в цепи:
   *
   *  - строки нет — контракт не включил ни одного заказа (стоимость заказа
   *    целиком покрыл гарантийный долг, и контракт закрыл выплату сразу).
   *    Сразу после транзакции узел цепи может ещё не отдать новую строку, и
   *    удаление по такому ответу оставило бы пакет в цепи без записи на узле.
   *    Поэтому запись удаляется сразу, только когда зеркало заказов
   *    подтверждает закрытие выплат, иначе её удаляет довоз следующего обхода;
   *  - пакет уже отправлен — состояние запишет дельта таблицы `payouts`, платёж кассиру заведёт довоз;
   *  - пакет открыт — в списке остаются заказы, которые контракт включил
   *    (выплата ждёт — pending). Их число сверяется со счётчиком пакета в
   *    цепи: расхождение значит, что узел ещё не разобрал блок включения, и
   *    отправку кассиру делает следующий обход.
   */
  private async finishOpen(
    coopname: string,
    payment_hash: string,
    payoutMethod: InnerPaymentMethod | null,
    opts: { fresh: boolean }
  ): Promise<void> {
    const projection = await this.paymentRepo.findByPaymentHash(coopname, payment_hash);
    if (!projection || !projection.is_open) return;

    const onChain = await this.chainPort.getPayout(coopname, payment_hash);
    if (!onChain) {
      // Сразу после транзакции запись удаляется, только если зеркало заказов
      // уже отражает её блок: выплата по каждому заказу закрыта либо заказ стёрт.
      if (opts.fresh && !(await this.allSettledWithoutTransfer(projection))) return;
      await this.paymentRepo.deleteByPaymentHash(coopname, payment_hash);
      this.logger.log(`[PAYOUT] пакет ${payment_hash}: в цепи пакета нет, заказов к переводу нет — запись удалена.`);
      return;
    }
    if (String(onChain.status) !== MarketplacePayoutChainStatuses.OPEN) return;

    const orders = await this.orderRepo.findByOrderHashes(coopname, projection.lines.map((l) => l.order_hash));
    const included = orders.filter((o) => o.payout_status === MarketplaceOrderPayoutStatuses.PENDING);
    if (included.length !== Number(onChain.orders)) {
      this.logger.warn(
        `[PAYOUT] пакет ${payment_hash}: в цепи ${onChain.orders} заказов, узел видит ${included.length} — блок включения ещё не разобран; отправит следующий обход.`
      );
      return;
    }
    await this.paymentRepo.applyLines(
      coopname,
      payment_hash,
      included.map((o) => ({ order_id: o.id, order_hash: o.order_hash }))
    );

    await this.chainPort.sendPayout(coopname, payment_hash);
    const sent = await this.paymentRepo.findByPaymentHash(coopname, payment_hash);
    if (sent?.is_pending) await this.createCorePayment(sent, payoutMethod);
  }

  /**
   * Контракт закрыл выплату по всем заказам списка без перевода: гарантийный
   * долг покрыл стоимость заказа (выплата completed), заказ после отказа
   * пайщика стёрт.
   */
  private async allSettledWithoutTransfer(projection: MarketplaceOutgoingPaymentRequestDomainEntity): Promise<boolean> {
    const orders = await this.orderRepo.findByOrderHashes(projection.coopname, projection.lines.map((l) => l.order_hash));
    return (
      orders.length > 0 &&
      orders.every((o) => !o.on_chain_present || o.payout_status === MarketplaceOrderPayoutStatuses.COMPLETED)
    );
  }

  /**
   * Платёж пакета в общем реестре кооператива — его подтверждает кассир.
   * `payment_hash` совпадает с outcome_hash исходящего платежа в gateway:
   * по нему кассирский gateway::outcomplete находит выплату.
   */
  private async createCorePayment(
    projection: MarketplaceOutgoingPaymentRequestDomainEntity,
    payoutMethod: InnerPaymentMethod | null
  ): Promise<void> {
    if (projection.core_payment_id) return;
    const method = payoutMethod ?? (await this.resolvePayoutMethod(projection.coopname, projection.payee_account));
    const corePayment = await this.coreGateway.createSystemOutgoingPayment({
      coopname: projection.coopname,
      username: projection.payee_account,
      quantity: Number.parseFloat(projection.amount),
      symbol: this.assetConfig.symbol,
      memo: projection.purpose,
      related_extension: 'marketplace',
      related_entity_id: projection.id,
      payment_hash: projection.payment_hash,
      payment_method_id: method?.method_id,
      payment_details: method
        ? {
            data: method.data,
            amount_plus_fee: projection.amount,
            amount_without_fee: projection.amount,
            fee_amount: '0',
            fee_percent: 0,
            fact_fee_percent: 0,
            tolerance_percent: 0,
          }
        : undefined,
    });
    if (!corePayment.id) return;
    await this.paymentRepo.applyCorePaymentId(projection.coopname, projection.payment_hash, corePayment.id);

    const event: MarketplaceCashierNewPaymentEvent = {
      coopname: projection.coopname,
      orders_count: projection.lines.length,
      payment_request_id: projection.id,
      supplier_account: projection.payee_account,
      amount: `${projection.amount} ${projection.symbol}`,
    };
    this.eventBus.emit(MARKETPLACE_CASHIER_NEW_PAYMENT_EVENT, event);
    this.logger.log(
      `[PAYOUT] пакет ${projection.payment_hash}: платёж кассиру ${projection.amount} ${projection.symbol} по ${projection.lines.length} заказам поставщика ${projection.payee_account}.`
    );
  }

  // ── Цепь ─────────────────────────────────────────────────────────────────

  /** Сумма, удержание и состояние пакета — из таблицы контракта. */
  @OnEvent(`delta::${MarketContract.contractName.production}::${MarketContract.Tables.Payouts.tableName}`)
  async onPayoutsDelta(delta: InnerChainDelta): Promise<void> {
    if (!delta.present || !delta.value) return;
    const value = delta.value as Partial<MarketContract.Tables.Payouts.IPayout>;
    const hash = String(value.hash ?? '').toLowerCase();
    const status = PAYOUT_STATUS_BY_CHAIN[String(value.status ?? '')];
    if (!hash || !status) return;
    await this.paymentRepo.applyChainState(delta.scope, hash, {
      amount: assetAmount(value.amount),
      withheld_amount: assetAmount(value.withheld),
      status,
    });
  }

  /** Кассир подтвердил перевод пакета: закрыть заказы, уведомить поставщика. */
  @OnEvent(`action::${MarketContract.contractName.production}::${MarketContract.Actions.PayConfirm.actionName}`)
  async onPayConfirm(action: InnerChainActionRecord): Promise<void> {
    const data = action.data as MarketContract.Actions.PayConfirm.IPayConfirm;
    if (!data?.coopname || !data?.outcome_hash) return;
    const hash = data.outcome_hash.toLowerCase();
    const before = await this.paymentRepo.findByPaymentHash(data.coopname, hash);
    if (!before) {
      this.logger.warn(`[PAYOUT] подтверждение кассира: пакет ${hash} не найден.`);
      return;
    }
    // Первое подтверждение — по отметке времени, а не по состоянию: состояние
    // «оплачен» дельта таблицы `payouts` того же блока могла поставить раньше.
    // Повтор события цепи поставщика второй раз не уведомляет.
    const first = !before.completed_at;
    const projection =
      (await this.paymentRepo.applyCompletion(data.coopname, hash, {
        completed_at: new Date(),
        payout_tx_hash: action.transaction_id,
      })) ?? before;
    await this.setCorePaymentStatus(projection, PaymentStatus.COMPLETED);
    await this.closeOrders(projection);
    if (!first) return;

    const event: MarketplaceSupplierPaymentConfirmedEvent = {
      coopname: projection.coopname,
      orders_count: projection.lines.length,
      payment_request_id: projection.id,
      supplier_account: projection.payee_account,
      amount: `${projection.amount} ${projection.symbol}`,
      payment_reference: action.transaction_id,
      item_name: await this.itemsOf(projection),
    };
    this.eventBus.emit(MARKETPLACE_SUPPLIER_PAYMENT_CONFIRMED_EVENT, event);
  }

  /** Кассир отказал в переводе пакета: вернуть заказы, уведомить поставщика. */
  @OnEvent(`action::${MarketContract.contractName.production}::${MarketContract.Actions.PayDecline.actionName}`)
  async onPayDecline(action: InnerChainActionRecord): Promise<void> {
    const data = action.data as MarketContract.Actions.PayDecline.IPayDecline;
    if (!data?.coopname || !data?.outcome_hash) return;
    const hash = data.outcome_hash.toLowerCase();
    const reason = data.reason || t('marketplace.payoutSync.reasonNotSpecified');
    const before = await this.paymentRepo.findByPaymentHash(data.coopname, hash);
    if (!before) {
      this.logger.warn(`[PAYOUT] отказ кассира: пакет ${hash} не найден.`);
      return;
    }
    // Первый отказ — по записанной причине, а не по состоянию: состояние
    // «отклонён» дельта таблицы `payouts` того же блока могла поставить раньше.
    const first = !before.decline_reason;
    const projection = (await this.paymentRepo.applyDecline(data.coopname, hash, reason)) ?? before;
    await this.setCorePaymentStatus(projection, PaymentStatus.CANCELLED);
    await this.releaseOrders(projection);
    if (!first) return;

    const event: MarketplaceSupplierPaymentDeclinedEvent = {
      coopname: projection.coopname,
      orders_count: projection.lines.length,
      payment_request_id: projection.id,
      supplier_account: projection.payee_account,
      amount: `${projection.amount} ${projection.symbol}`,
      reason,
    };
    this.eventBus.emit(MARKETPLACE_SUPPLIER_PAYMENT_DECLINED_EVENT, event);
  }

  /** Оплаченный пакет: Дт 76 / Кт 51 по каждому ещё не закрытому заказу. */
  private async closeOrders(projection: MarketplaceOutgoingPaymentRequestDomainEntity): Promise<void> {
    await this.settleOrders(projection, (hashes) => this.chainPort.closePayouts(projection.coopname, hashes));
  }

  /** Отклонённый пакет: каждый ещё не возвращённый заказ — в ожидание выплаты. */
  private async releaseOrders(projection: MarketplaceOutgoingPaymentRequestDomainEntity): Promise<void> {
    await this.settleOrders(projection, (hashes) => this.chainPort.releasePayouts(projection.coopname, hashes));
  }

  /**
   * Заказы пакета, которые ещё ждут (pending), отправляются частями; когда
   * ждущих не осталось, пакет отмечается закрытым и обход его больше не берёт.
   */
  private async settleOrders(
    projection: MarketplaceOutgoingPaymentRequestDomainEntity,
    send: (order_hashes: string[]) => Promise<unknown>
  ): Promise<void> {
    if (this.busy.has(projection.payment_hash)) return;
    this.busy.add(projection.payment_hash);
    try {
      const orders = await this.orderRepo.findByOrderHashes(projection.coopname, projection.lines.map((l) => l.order_hash));
      const waiting = orders.filter((o) => o.on_chain_present && o.payout_status === MarketplaceOrderPayoutStatuses.PENDING);
      if (!waiting.length) {
        await this.paymentRepo.markSettled(projection.coopname, projection.payment_hash, new Date());
        return;
      }
      await this.sendInParts(
        waiting.map((o) => o.order_hash),
        send,
        // i18n-ignore: подпись шага в журнале узла — текст для оператора, не для пайщика
        `заказы пакета ${projection.payment_hash}`
      );
    } finally {
      this.busy.delete(projection.payment_hash);
    }
  }

  // ── Вспомогательное ──────────────────────────────────────────────────────

  private async setCorePaymentStatus(
    projection: MarketplaceOutgoingPaymentRequestDomainEntity,
    status: PaymentStatus
  ): Promise<void> {
    if (!projection.core_payment_id) return;
    try {
      await this.coreGateway.setPaymentStatus({ id: projection.core_payment_id, status });
    } catch (err: any) {
      this.logger.warn(`[PAYOUT] статус платежа ${projection.core_payment_id} в реестре кассира не обновлён: ${err.message}`);
    }
  }

  /** Реквизиты поставщика на момент пакета; без реквизитов платёж заводится всё равно. */
  private async resolvePayoutMethod(coopname: string, payee: string): Promise<InnerPaymentMethod | null> {
    try {
      return await this.supplierSettings.resolvePayoutMethod(coopname, payee);
    } catch (err: any) {
      this.logger.warn(`[PAYOUT] реквизиты поставщика ${payee} не прочитаны: ${err.message}; платёж без реквизитов.`);
      return null;
    }
  }

  /**
   * Назначение платежа — по договору поставщика: у поставщика один договор,
   * поэтому все заказы пакета платятся одним назначением. Дата заключения
   * (`ГГГГ-ММ-ДД`) приводится к виду `ДД.ММ.ГГГГ`.
   */
  private async buildPurpose(coopname: string, payee: string): Promise<string> {
    const supplier = await this.supplierRegistry.findByMember(coopname, payee);
    const contractNumber = supplier?.contract_number ?? null;
    if (!contractNumber) return t('marketplace.aplReception.contractPaymentLabel');
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(supplier?.contract_date ?? '');
    const datePart = m ? t('marketplace.aplReception.contractDatePart', { day: m[3], month: m[2], year: m[1] }) : '';
    return t('marketplace.aplReception.contractNumberLabel', { contractNumber, datePart });
  }

  /** Что оплачено — для уведомления поставщику: «имущество по 6 заказам: Мёд, Чай и ещё 2». */
  private async itemsOf(projection: MarketplaceOutgoingPaymentRequestDomainEntity): Promise<string | undefined> {
    try {
      const orders = await this.orderRepo.findByOrderHashes(projection.coopname, projection.lines.map((l) => l.order_hash));
      const offers = await this.offerRepo.findByIds([...new Set(orders.map((o) => o.offer_id))]);
      const names = [...new Set(offers.map((o) => o.product_name).filter(Boolean))];
      if (!names.length) return undefined;
      const shown = names.slice(0, ITEM_NAMES_IN_NOTICE).join(', ');
      const items = names.length > ITEM_NAMES_IN_NOTICE
        ? t('marketplace.payoutBatch.itemsMore', { items: shown, count: names.length - ITEM_NAMES_IN_NOTICE })
        : shown;
      return t('marketplace.payoutBatch.itemsOfOrders', { orders: ordersDative(projection.lines.length), items });
    } catch (err: any) {
      this.logger.warn(`[PAYOUT] состав пакета ${projection.payment_hash} не прочитан: ${err.message}; уведомление с суммой.`);
      return undefined;
    }
  }
}

/**
 * Цепь отклонила транзакцию целиком — отказ контракта либо неверный аргумент
 * действия (статус 400): в цепи ничего не изменилось. Сбой связи и превышение
 * времени ответа таким отказом не считаются — цепь могла транзакцию принять.
 */
function isChainRefusal(err: unknown): boolean {
  return chainRefusalOf(err)?.getStatus() === 400;
}

/** «1500.0000 RUB» → «1500.0000»; пусто — «0». */
function assetAmount(value: unknown): string {
  const raw = String(value ?? '').trim().split(' ')[0];
  return raw && Number.isFinite(Number(raw)) ? raw : '0';
}

export const MARKETPLACE_SUPPLIER_PAYOUT_SERVICE = Symbol('MARKETPLACE_SUPPLIER_PAYOUT_SERVICE');
