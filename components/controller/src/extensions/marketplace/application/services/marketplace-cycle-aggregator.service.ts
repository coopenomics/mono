import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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
import type { MarketplaceConsolidatedRequestDomainEntity } from '../../domain/entities/marketplace-consolidated-request.entity';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';

/**
 * Story 4.2: cycle-type-aware агрегация Order'ов в `marketplace_consolidated_request`.
 *
 * Backend-only (Locked Decision L10): on-chain представления заявки НЕТ;
 * агрегация полностью в PG. Order'ы привязываются к заявке через
 * `marketplace_order.cycle_id`.
 *
 * Поведение per cycle_type:
 *
 *  - **time_based**: cron-метод `aggregateTimeBased` (раз в 5 минут)
 *    для каждого Offer'а с time_based находит «текущий пул»
 *    (unassigned active Orders) → если `now >= cycle_start + cycle_days`
 *    решает:
 *      sum >= min_threshold (или min_threshold null) → consolidated_request
 *          status='PENDING_SUPPLIER_ACCEPT', expires_at = now + acceptance_window;
 *      sum < min_threshold → consolidated_request status='EXPIRED_NO_THRESHOLD'
 *          без assignToCycle (Story 4.3 unblk per-Order'ам пула).
 *
 *  - **volume_based**: метод `evaluateVolumeBasedAfterCreate(offer_id)`
 *    вызывается СИНХРОННО из `MarketplaceOrderCreateService` после persist
 *    нового Order'а; если sum >= target_volume → instant
 *    consolidated_request status='PENDING_SUPPLIER_ACCEPT'.
 *    Cron-fallback `aggregateVolumeBasedExpired` (раз в час) — если объём
 *    не накоплен и истёк `cycle_start + max_wait_days` →
 *    consolidated_request status='EXPIRED_NO_VOLUME' (Story 4.3 unblk).
 *
 *  - **open_subscription**: backend НЕ создаёт автоматически. Метод
 *    `triggerOpenSubscription(offer_id, supplier_account)` вызывается из
 *    Resolver когда поставщик жмёт «Запустить поставку сейчас» →
 *    instant consolidated_request status='ACCEPTED'.
 *
 *  - **individual**: backend НЕ агрегирует Order'ы в заявку. Метод
 *    `applyIndividualPending(orderId)` вызывается из `OrderCreateService`
 *    сразу после persist — Order.status: ACTIVE → ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL.
 *
 * Acceptance window (для time/volume) сейчас захардкожена 48ч; в Story 9.x
 * вынесем в конфиг кооператива.
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
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceCycleAggregatorService.name);
  }

  /**
   * Cron-агрегатор time_based циклов. Запускается раз в 5 минут;
   * сканирует ACTIVE Offer'ы с `cycle_type='time_based'` + cycle_days
   * заполнен, для каждого проверяет `now >= cycle_start + cycle_days`.
   */
  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'marketplace.cycle.aggregateTimeBased' })
  async aggregateTimeBased(): Promise<void> {
    try {
      const now = new Date();
      const offers = await this.offerRepo.listAllActiveTimeBased();
      this.logger.debug(
        `MarketplaceCycleAggregatorService.aggregateTimeBased: сканирую ${offers.length} ACTIVE time_based Offer'ов`
      );
      for (const offer of offers) {
        await this.processTimeBasedOffer(offer.id, offer.coopname, offer.supplier_account, offer.cycle_days, offer.min_threshold, offer.price_per_unit, now);
      }
    } catch (error: any) {
      this.logger.error(
        `MarketplaceCycleAggregatorService.aggregateTimeBased: общая ошибка cron-цикла — ${error.message}`,
        error.stack
      );
    }
  }

  private async processTimeBasedOffer(
    offer_id: string,
    coopname: string,
    supplier_account: string,
    cycle_days: number | null,
    min_threshold: number | null,
    price_per_unit: string,
    now: Date
  ): Promise<MarketplaceConsolidatedRequestDomainEntity | null> {
    if (!cycle_days) return null;

    const pool = await this.orderRepo.findUnassignedActiveByOffer(coopname, offer_id);
    if (pool.length === 0) return null;

    const cycle_start = pool.reduce<Date>((min, o) => {
      const t = o.blocked_at ?? o.created_at;
      return t < min ? t : min;
    }, pool[0].blocked_at ?? pool[0].created_at);
    const cycle_end = new Date(cycle_start.getTime() + cycle_days * 86_400_000);
    if (now < cycle_end) return null;

    const total_quantity = pool.reduce((sum, o) => sum + o.quantity, 0);

    // sum < min_threshold → terminal EXPIRED_NO_THRESHOLD (Story 4.3 unblk)
    if (min_threshold != null && total_quantity < min_threshold) {
      const expired = await this.cycleRepo.create({
        coopname,
        offer_id,
        supplier_account,
        cycle_type: 'time_based',
        total_quantity,
        total_amount: this.computeTotalAmount(price_per_unit, total_quantity),
        status: 'EXPIRED_NO_THRESHOLD',
        cycle_started_at: cycle_start,
        cycle_ended_at: cycle_end,
        expires_at: null,
        triggered_by_supplier_at: null,
      });
      this.logger.log(
        `MarketplaceCycleAggregatorService: offer=${offer_id} time_based ЗАКРЫТ без порога (sum=${total_quantity} < threshold=${min_threshold}) — request ${expired.id}, Story 4.3 unblk`
      );
      return expired;
    }

    // sum >= min_threshold (или null) → консолидированная заявка
    return await this.formConsolidatedRequest(
      coopname,
      offer_id,
      supplier_account,
      'time_based',
      total_quantity,
      price_per_unit,
      cycle_start,
      cycle_end,
      pool,
      now
    );
  }

  /**
   * Story 4.2: volume_based instant trigger. Вызывается из
   * `MarketplaceOrderCreateService` сразу после persist нового Order'а.
   * Если sum активного пула >= target_volume — formConsolidatedRequest.
   */
  async evaluateVolumeBasedAfterCreate(
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
      'volume_based',
      sum,
      price_per_unit,
      cycle_start,
      null,
      pool,
      now
    );
  }

  /**
   * Story 4.2: cron-fallback volume_based expire — sum < target_volume
   * + now > cycle_start + max_wait_days. Раз в час сканирует Offer'ы.
   */
  @Cron(CronExpression.EVERY_HOUR, { name: 'marketplace.cycle.aggregateVolumeBasedExpired' })
  async aggregateVolumeBasedExpired(): Promise<void> {
    try {
      const now = new Date();
      const offers = await this.offerRepo.listAllActiveVolumeBased();
      this.logger.debug(
        `MarketplaceCycleAggregatorService.aggregateVolumeBasedExpired: сканирую ${offers.length} ACTIVE volume_based Offer'ов`
      );
      for (const offer of offers) {
        if (!offer.max_wait_days) continue;
        const pool = await this.orderRepo.findUnassignedActiveByOffer(offer.coopname, offer.id);
        if (pool.length === 0) continue;

        const cycle_start = pool.reduce<Date>((min, o) => {
          const t = o.blocked_at ?? o.created_at;
          return t < min ? t : min;
        }, pool[0].blocked_at ?? pool[0].created_at);
        const deadline = new Date(cycle_start.getTime() + offer.max_wait_days * 86_400_000);
        if (now < deadline) continue;

        const total_quantity = pool.reduce((sum, o) => sum + o.quantity, 0);
        if (offer.target_volume == null || total_quantity >= offer.target_volume) continue;

        const expired = await this.cycleRepo.create({
          coopname: offer.coopname,
          offer_id: offer.id,
          supplier_account: offer.supplier_account,
          cycle_type: 'volume_based',
          total_quantity,
          total_amount: this.computeTotalAmount(offer.price_per_unit, total_quantity),
          status: 'EXPIRED_NO_VOLUME',
          cycle_started_at: cycle_start,
          cycle_ended_at: deadline,
          expires_at: null,
          triggered_by_supplier_at: null,
        });
        this.logger.log(
          `MarketplaceCycleAggregatorService: offer=${offer.id} volume_based ЗАКРЫТ без объёма (sum=${total_quantity} < target=${offer.target_volume}) — request ${expired.id}, Story 4.3 unblk`
        );
      }
    } catch (error: any) {
      this.logger.error(
        `MarketplaceCycleAggregatorService.aggregateVolumeBasedExpired: общая ошибка — ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Story 4.2: поставщик жмёт «Запустить поставку сейчас» по open_subscription.
   * Создаёт consolidated_request status='ACCEPTED' сразу (нажатие = акцепт
   * всего пула, refund-кнопка не показывается).
   */
  async triggerOpenSubscription(
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
    if (offer.cycle_type !== 'open_subscription') {
      throw new BadRequestException(
        `Запуск поставки доступен только для cycle_type='open_subscription'; этот Offer — «${offer.cycle_type}».`
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
      'open_subscription',
      total_quantity,
      offer.price_per_unit,
      cycle_start,
      null,
      pool,
      now,
      { triggered: true }
    );
  }

  // ── private ──────────────────────────────────────────────────────

  /**
   * Создание consolidated_request + bulk assignToCycle всем Order'ам пула.
   * Status:
   *  - time_based / volume_based → PENDING_SUPPLIER_ACCEPT + expires_at = now + 48ч;
   *  - open_subscription (triggered: true) → ACCEPTED + Order.status → ACCEPTED.
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
    return cycle;
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
