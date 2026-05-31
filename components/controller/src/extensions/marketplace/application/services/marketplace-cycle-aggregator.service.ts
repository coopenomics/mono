import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_CONSOLIDATED_REQUEST_REPOSITORY,
  type MarketplaceConsolidatedRequestDomainRepository,
} from '../../domain/repositories/marketplace-consolidated-request.repository';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import {
  MARKETPLACE_OFFER_COUNTERS_SERVICE,
  MarketplaceOfferCountersService,
} from './marketplace-offer-counters.service';
import type { MarketplaceConsolidatedRequestDomainEntity } from '../../domain/entities/marketplace-consolidated-request.entity';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import type { MarketplaceOrderStatus } from '../../domain/entities/marketplace-order.types';

/**
 * Агрегация Order'ов в `marketplace_consolidated_request` (партию) по способу
 * поставки. Backend-only (Locked Decision L10): on-chain представления заявки
 * НЕТ, агрегация полностью в PG. Order'ы привязываются к заявке через
 * `marketplace_order.cycle_id`.
 *
 * Поведение по `cycle_type` (ревизия — 2 способа):
 *
 *  - **collective** (коллективная закупка): Order'ы копятся в общий пул.
 *      • `evaluateCollectiveAfterCreate` — вызывается СИНХРОННО из
 *        `MarketplaceOrderCreateService` после persist нового Order'а. Если у
 *        Offer'а задан `target_volume` и sum пула >= target → instant
 *        consolidated_request status='PENDING_SUPPLIER_ACCEPT'.
 *      • `triggerCollectiveSupply(offer_id, supplier_account)` — вызывается из
 *        Resolver, когда поставщик жмёт «Запустить поставку сейчас» (доступно
 *        для любой collective-оферты независимо от target_volume) → instant
 *        consolidated_request status='ACCEPTED'.
 *      Жёсткого таймера ожидания нет: пока партия не собралась, заказчик
 *      выходит из неё сам (cancelorder) в любой момент до акцепта.
 *
 *  - **individual**: backend НЕ агрегирует Order'ы в заявку. Метод
 *    `applyIndividualPending(orderId)` вызывается из `OrderCreateService`
 *    сразу после persist — Order.status: ACTIVE → ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL.
 *
 * Acceptance window (для авто-собранной партии) сейчас захардкожена 48ч; в
 * Story 9.x вынесем в конфиг кооператива.
 *
 * Cron `expireUnacceptedPending` (раз в 10 мин) — сканит
 * `PENDING_SUPPLIER_ACCEPT` заявки с `expires_at < now` → консолид-заявка →
 * EXPIRED_NO_RESPONSE + Order'ы пула → CANCELLED_BY_SUPPLIER с
 * reason='expired_no_response' (поставщик не нажал ни Accept, ни Decline в
 * 48-часовом окне).
 *
 *  Best-effort serialization: chain-fail одного Order'а лог error +
 *  продолжаем пул; следующий запуск cron подберёт; partial-mismatch
 *  закрывается админ-reconciliation (Story 9.x).
 */
@Injectable()
export class MarketplaceCycleAggregatorService {
  private static readonly ACCEPTANCE_WINDOW_HOURS = 48;
  private static readonly DEFAULT_ASSET_DECIMALS = 4;

  constructor(
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly offerRepo: MarketplaceOfferDomainRepository,
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_CONSOLIDATED_REQUEST_REPOSITORY)
    private readonly cycleRepo: MarketplaceConsolidatedRequestDomainRepository,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(MARKETPLACE_OFFER_COUNTERS_SERVICE)
    private readonly offerCounters: MarketplaceOfferCountersService,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceCycleAggregatorService.name);
  }

  /**
   * Коллективная закупка с целевым объёмом — instant trigger. Вызывается из
   * `MarketplaceOrderCreateService` сразу после persist нового Order'а. Если у
   * Offer'а задан `target_volume` и sum активного пула >= target →
   * formConsolidatedRequest. Если объёма нет (manual-only collective) или пул
   * ещё не добрал — no-op (партия стартует ручным запуском поставщика).
   */
  async evaluateCollectiveAfterCreate(
    coopname: string,
    offer_id: string,
    supplier_account: string,
    target_volume: number | null,
    price_per_unit: string
  ): Promise<MarketplaceConsolidatedRequestDomainEntity | null> {
    if (!target_volume) return null;
    const sum = await this.orderRepo.sumUnassignedActiveByOffer(coopname, offer_id);
    if (sum < target_volume) return null;

    const pool = await this.orderRepo.findUnassignedActiveByOffer(coopname, offer_id);
    if (pool.length === 0) return null;
    const cycle_start = pool.reduce<Date>((min, o) => {
      const t = o.blocked_at ?? o.created_at;
      return t < min ? t : min;
    }, pool[0].blocked_at ?? pool[0].created_at);
    const now = new Date();
    return await this.formConsolidatedRequest(
      coopname,
      offer_id,
      supplier_account,
      'collective',
      sum,
      price_per_unit,
      cycle_start,
      null,
      pool,
      now
    );
  }

  /**
   * Поставщик жмёт «Запустить поставку сейчас» по коллективной закупке.
   * Доступно для любой collective-оферты (с целевым объёмом или без) —
   * фиксирует весь текущий пул в партию и сразу акцептует её
   * (consolidated_request status='ACCEPTED', нажатие = акцепт всего пула,
   * refund-кнопка не показывается).
   */
  async triggerCollectiveSupply(
    coopname: string,
    offer_id: string,
    requestor_account: string
  ): Promise<MarketplaceConsolidatedRequestDomainEntity> {
    const offer = await this.offerRepo.findById(offer_id);
    if (!offer) throw new NotFoundException('Предложение не найдено.');
    if (offer.coopname !== coopname) {
      throw new ForbiddenException('Предложение принадлежит другому кооперативу.');
    }
    if (offer.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Предложение в статусе «${offer.status}» — запуск поставки запрещён.`
      );
    }
    if (offer.cycle_type !== 'collective') {
      throw new BadRequestException(
        `Запуск поставки доступен только для коллективной закупки; этот Offer — «${offer.cycle_type}».`
      );
    }
    if (offer.supplier_account !== requestor_account) {
      throw new ForbiddenException('Запустить поставку может только поставщик-владелец Offer\'а.');
    }

    const pool = await this.orderRepo.findUnassignedActiveByOffer(coopname, offer_id);
    if (pool.length === 0) {
      throw new BadRequestException('Пул заказов пуст — запускать нечего.');
    }
    const cycle_start = pool.reduce<Date>((min, o) => {
      const t = o.blocked_at ?? o.created_at;
      return t < min ? t : min;
    }, pool[0].blocked_at ?? pool[0].created_at);
    const total_quantity = pool.reduce((sum, o) => sum + o.quantity, 0);
    const now = new Date();

    return await this.formConsolidatedRequest(
      coopname,
      offer_id,
      offer.supplier_account,
      'collective',
      total_quantity,
      offer.price_per_unit,
      cycle_start,
      null,
      pool,
      now,
      { triggered: true }
    );
  }

  /**
   * Story 4.3: cron-cleanup непринятых консолидированных заявок. Каждые
   * 10 минут сканирует `PENDING_SUPPLIER_ACCEPT` заявки с `expires_at < now`
   * (поставщик не нажал ни Accept, ни Decline в acceptance-окне).
   *
   * Действия per истёкшую заявку:
   *  1. `cycleRepo.applyStatusTransition(id, 'EXPIRED_NO_RESPONSE',
   *     {decline_reason: 'expired_no_response'})`.
   *  2. `expirePoolOnChain(orders, 'CANCELLED_BY_SUPPLIER',
   *     'expired_no_response')` — per-Order on-chain `expireorder` +
   *     counter `onOrderUnblocked` + applyStatusTransition.
   *
   * Если on-chain expire одного Order'а упал — лог error + продолжаем
   * остальные; следующий запуск cron подберёт повторно (заявка остаётся
   * `EXPIRED_NO_RESPONSE`, но `findExpiredAwaitingResponse` его уже не
   * вернёт, потому для повторной попытки админ делает manual
   * reconciliation в Story 9.x).
   */
  @Cron('*/10 * * * *', { name: 'marketplace.cycle.expireUnacceptedPending' })
  async expireUnacceptedPending(): Promise<void> {
    try {
      const now = new Date();
      const expired = await this.cycleRepo.findExpiredAwaitingResponse(now);
      if (expired.length === 0) return;
      this.logger.log(
        `MarketplaceCycleAggregatorService.expireUnacceptedPending: ${expired.length} непринятых заявок (expires_at < now) — закрываю`
      );
      for (const cycle of expired) {
        try {
          await this.cycleRepo.applyStatusTransition(cycle.id, 'EXPIRED_NO_RESPONSE', {
            decline_reason: 'expired_no_response',
          });
          const pool = await this.orderRepo.findByCycleId(cycle.coopname, cycle.id);
          await this.expirePoolOnChain(
            pool,
            'CANCELLED_BY_SUPPLIER',
            `expired_no_response: поставщик ${cycle.supplier_account} не ответил по заявке ${cycle.id} в acceptance-окне`
          );
        } catch (innerErr: any) {
          this.logger.error(
            `MarketplaceCycleAggregatorService.expireUnacceptedPending: cycle ${cycle.id} fail — ${innerErr.message}`,
            innerErr.stack
          );
        }
      }
    } catch (error: any) {
      this.logger.error(
        `MarketplaceCycleAggregatorService.expireUnacceptedPending: общая ошибка — ${error.message}`,
        error.stack
      );
    }
  }

  // ── private ──────────────────────────────────────────────────────

  /**
   * Story 4.3: per-Order on-chain `expireorder` + counter `onOrderUnblocked`
   * + Order.status → terminalStatus. Best-effort: chain fail одного
   * Order'а лог + продолжаем; counter fail (Offer уже неактивен и т.п.)
   * — лог warn + всё равно меняем Order.status (on-chain unblk прошёл,
   * единственное место рассинхронизации — quantity_available Offer'а).
   *
   * @param pool — Order'ы для expire (как правило findByCycleId или
   *   findUnassignedActiveByOffer).
   * @param terminalStatus — обычно CANCELLED_BY_SUPPLIER.
   * @param reason — попадает в `marketplace_order.last_status_reason`.
   */
  private async expirePoolOnChain(
    pool: MarketplaceOrderDomainEntity[],
    terminalStatus: MarketplaceOrderStatus,
    reason: string
  ): Promise<{ succeeded: number; failed: number }> {
    let succeeded = 0;
    let failed = 0;
    for (const order of pool) {
      try {
        await this.chainPort.expireOrder({
          coopname: order.coopname,
          order_hash: order.order_hash,
        });
        try {
          await this.offerCounters.onOrderUnblocked(order.offer_id, order.quantity);
        } catch (counterErr: any) {
          this.logger.warn(
            `MarketplaceCycleAggregatorService.expirePoolOnChain: counter onOrderUnblocked упал (offer=${order.offer_id}, qty=${order.quantity}, order=${order.id}): ${counterErr.message} — продолжаю applyStatusTransition`
          );
        }
        await this.orderRepo.applyStatusTransition(order.id, terminalStatus, reason);
        succeeded++;
      } catch (chainErr: any) {
        failed++;
        this.logger.error(
          `MarketplaceCycleAggregatorService.expirePoolOnChain: chain.expireOrder упал для Order ${order.id} (order_hash=${order.order_hash}, offer=${order.offer_id}): ${chainErr.message}. Order остаётся в исходном статусе, повторная попытка через следующий cron-тик / manual reconciliation.`,
          chainErr.stack
        );
      }
    }
    if (failed > 0) {
      this.logger.warn(
        `MarketplaceCycleAggregatorService.expirePoolOnChain: завершено для пула из ${pool.length} Order'ов (succeeded=${succeeded}, failed=${failed}); terminal=${terminalStatus}`
      );
    }
    return { succeeded, failed };
  }

  /**
   * Создание consolidated_request + bulk assignToCycle всем Order'ам пула.
   * Status:
   *  - авто-сбор по целевому объёму → PENDING_SUPPLIER_ACCEPT + expires_at = now + 48ч;
   *  - ручной запуск поставщика (triggered: true) → ACCEPTED + Order.status → ACCEPTED.
   */
  private async formConsolidatedRequest(
    coopname: string,
    offer_id: string,
    supplier_account: string,
    cycle_type: MarketplaceOrderDomainEntity['cycle_type'],
    total_quantity: number,
    price_per_unit: string,
    cycle_started_at: Date,
    cycle_ended_at: Date | null,
    pool: MarketplaceOrderDomainEntity[],
    now: Date,
    options: { triggered?: boolean } = {}
  ): Promise<MarketplaceConsolidatedRequestDomainEntity> {
    const triggered = options.triggered ?? false;
    const status = triggered ? 'ACCEPTED' : 'PENDING_SUPPLIER_ACCEPT';
    const orderStatus = triggered ? 'ACCEPTED' : 'ACCEPTED_PENDING_SUPPLIER';
    const expires_at = triggered
      ? null
      : new Date(now.getTime() + MarketplaceCycleAggregatorService.ACCEPTANCE_WINDOW_HOURS * 3_600_000);

    const cycle = await this.cycleRepo.create({
      coopname,
      offer_id,
      supplier_account,
      cycle_type,
      total_quantity,
      total_amount: this.computeTotalAmount(price_per_unit, total_quantity),
      status,
      cycle_started_at,
      cycle_ended_at,
      expires_at,
      triggered_by_supplier_at: triggered ? now : null,
    });

    const orderIds = pool.map((o) => o.id);
    const affected = await this.orderRepo.assignToCycle(orderIds, cycle.id, orderStatus);

    this.logger.log(
      `MarketplaceCycleAggregatorService: offer=${offer_id} cycle_type=${cycle_type} → consolidated_request=${cycle.id} status=${status}; assigned ${affected}/${orderIds.length} Order'ов`
    );

    // Ручной запуск поставщика — это одновременно создание и акцепт заявки.
    // БД уже помечена ACCEPTED, но on-chain Order остаётся в статусе
    // блокировки. Без on-chain `acceptOrder` последующий `signsupp` на акте
    // приёмки падает ассертом «Заказ не в статусе акцепта». Для авто-собранной
    // по объёму партии on-chain accept делает отдельный шаг
    // marketplaceAcceptConsolidatedRequest; для triggered-пути выполняем его
    // здесь, иначе магистраль ручного запуска блокируется на приёмке.
    if (triggered) {
      await this.acceptPoolOnChain(pool, supplier_account);
    }

    return cycle;
  }

  /**
   * Ручной запуск: per-Order on-chain `acceptOrder` (offerer = поставщик).
   * Best-effort, симметрично expirePoolOnChain: chain fail одного Order'а —
   * лог error + продолжаем; Order остаётся ACCEPTED в БД (assignToCycle уже
   * прошёл), рассинхрон чинится manual reconciliation / повторным запуском.
   */
  private async acceptPoolOnChain(
    pool: MarketplaceOrderDomainEntity[],
    offerer_account: string
  ): Promise<{ succeeded: number; failed: number }> {
    let succeeded = 0;
    let failed = 0;
    for (const order of pool) {
      try {
        await this.chainPort.acceptOrder({
          coopname: order.coopname,
          offerer: offerer_account,
          order_hash: order.order_hash,
        });
        succeeded++;
      } catch (chainErr: any) {
        failed++;
        this.logger.error(
          `MarketplaceCycleAggregatorService.acceptPoolOnChain: chain.acceptOrder упал для Order ${order.id} (order_hash=${order.order_hash}, offerer=${offerer_account}): ${chainErr.message}. Order остаётся ACCEPTED в БД, on-chain accept не прошёл — повтор через manual reconciliation.`,
          chainErr.stack
        );
      }
    }
    if (failed > 0) {
      this.logger.warn(
        `MarketplaceCycleAggregatorService.acceptPoolOnChain: завершено для пула из ${pool.length} Order'ов (succeeded=${succeeded}, failed=${failed})`
      );
    }
    return { succeeded, failed };
  }

  private computeTotalAmount(price_per_unit: string, quantity: number): string {
    const price = Number.parseFloat(price_per_unit);
    if (!Number.isFinite(price)) return '0.0000';
    return (price * quantity).toFixed(MarketplaceCycleAggregatorService.DEFAULT_ASSET_DECIMALS);
  }
}

export const MARKETPLACE_CYCLE_AGGREGATOR_SERVICE = Symbol(
  'MARKETPLACE_CYCLE_AGGREGATOR_SERVICE'
);
