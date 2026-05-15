import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import type { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';

export const MARKETPLACE_OFFER_COUNTERS_SERVICE = Symbol('MARKETPLACE_OFFER_COUNTERS_SERVICE');

/**
 * Story 3.4: backend ведёт `quantity_available` / `quantity_blocked` /
 * `quantity_consumed` на Offer'е при операциях с Order'ом.
 *
 * Точка интеграции с Эпиком 4 (`o.mkt.block` / `o.mkt.unblock` /
 * `o.mkt.consume`+`o.mkt.consume2` canonical actions из PR #375):
 * order-side syncer вызывает эти методы внутри `dispatch` после `save`
 * сущности Order и до `emit pubsub` (см. controller/CLAUDE.md
 * Dispatch pipeline, INV-12). Атомарность через SQL UPDATE с CAS-условием
 * — гонки между параллельными Order-блокировками не разрушают инвариант.
 *
 * Инвариант (для не-unlimited Offer'ов):
 *   available + blocked + consumed == lifetime_published
 * (lifetime_published — изначальное `quantity_available` при `create`).
 * Инвариант поддерживается дельтами: блок −A +B, разблок +A −B,
 * consume −B +C — изменение суммы 0.
 *
 * `EventEmitter2` пингует канал `marketplace.offer.counters.changed`
 * после успешной операции — Story 3.5 каталог / offerer-вкладка
 * «Активность» подписываются (Phase 2 GraphQL subscription).
 */
@Injectable()
export class MarketplaceOfferCountersService {
  public static readonly EVENT_CHANGED = 'marketplace.offer.counters.changed';

  constructor(
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly repo: MarketplaceOfferDomainRepository,
    private readonly eventBus: EventEmitter2
  ) {}

  async onOrderBlocked(offer_id: string, qty: number): Promise<MarketplaceOfferDomainEntity> {
    this.assertPositive(qty);
    const result = await this.repo.applyBlockDelta(offer_id, qty);
    if (!result.ok || !result.offer) {
      this.throwForReason(result.reason, offer_id, 'block', qty);
    }
    this.emit(result.offer!, 'block', qty);
    return result.offer!;
  }

  async onOrderUnblocked(offer_id: string, qty: number): Promise<MarketplaceOfferDomainEntity> {
    this.assertPositive(qty);
    const result = await this.repo.applyUnblockDelta(offer_id, qty);
    if (!result.ok || !result.offer) {
      this.throwForReason(result.reason, offer_id, 'unblock', qty);
    }
    this.emit(result.offer!, 'unblock', qty);
    return result.offer!;
  }

  async onOrderConsumed(offer_id: string, qty: number): Promise<MarketplaceOfferDomainEntity> {
    this.assertPositive(qty);
    const result = await this.repo.applyConsumeDelta(offer_id, qty);
    if (!result.ok || !result.offer) {
      this.throwForReason(result.reason, offer_id, 'consume', qty);
    }
    this.emit(result.offer!, 'consume', qty);
    return result.offer!;
  }

  /**
   * Корректировка «факт меньше заказа» (FR23) — разница K возвращается
   * на available. Семантически = unblock на разницу.
   */
  async onOrderAdjusted(offer_id: string, qty_diff: number): Promise<MarketplaceOfferDomainEntity> {
    return this.onOrderUnblocked(offer_id, qty_diff);
  }

  /**
   * Fork rollback (ADR-005): Order в block-состоянии откатывается
   * через `restoreFromVersions`. Counter возвращается без CAS-проверки.
   *
   * Дёргается из ForkRegistry handler'а `MarketplaceOrderSyncService`
   * (см. scaffolding `marketplace-order-syncer.service.ts` и
   * spec-3-4-bc-integration.md секция 2.5). Каждый Order, который
   * был в `quantity_blocked` Offer'а на момент rollback'а, должен
   * вызвать `onOrderRolledBack(offer_id, qty)` — иначе counters
   * разъедутся с реальностью.
   */
  async onOrderRolledBack(offer_id: string, qty: number): Promise<MarketplaceOfferDomainEntity> {
    this.assertPositive(qty);
    const result = await this.repo.applyRollbackDelta(offer_id, qty);
    if (!result.ok || !result.offer) {
      this.throwForReason(result.reason, offer_id, 'rollback', qty);
    }
    this.emit(result.offer!, 'rollback', qty);
    return result.offer!;
  }

  private assertPositive(qty: number): void {
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new BadRequestException(`qty должен быть целым >0, получено: ${qty}`);
    }
  }

  private throwForReason(
    reason: string | undefined,
    offer_id: string,
    op: string,
    qty: number
  ): never {
    switch (reason) {
      case 'offer_not_found':
        throw new NotFoundException(`Offer ${offer_id} не найден`);
      case 'offer_not_active':
        throw new BadRequestException(
          `Offer ${offer_id} не в статусе ACTIVE — операция '${op}' (${qty}) запрещена`
        );
      case 'insufficient_available':
        throw new BadRequestException(
          `Недостаточно available для блокировки ${qty} на Offer ${offer_id}`
        );
      case 'insufficient_blocked':
        throw new BadRequestException(
          `Недостаточно blocked для операции ${op} (${qty}) на Offer ${offer_id}`
        );
      default:
        throw new BadRequestException(
          `Не удалось применить counters delta ${op}(${qty}) на Offer ${offer_id}`
        );
    }
  }

  private emit(offer: MarketplaceOfferDomainEntity, op: string, qty: number): void {
    this.eventBus.emit(MarketplaceOfferCountersService.EVENT_CHANGED, {
      offer_id: offer.id,
      supplier_account: offer.supplier_account,
      op,
      qty,
      quantity_available: offer.quantity_available,
      quantity_blocked: offer.quantity_blocked,
      quantity_consumed: offer.quantity_consumed,
      unlimited_flag: offer.unlimited_flag,
    });
  }
}
