import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import type { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';
import type { OfferPackageDelta } from '../../domain/entities/marketplace-offer.types';
import { MARKETPLACE_OFFER_COUNTERS_CHANGED_EVENT } from '../events/marketplace-notification.events';
import { DomainError } from '@coopenomics/extension-kit';

export const MARKETPLACE_OFFER_COUNTERS_SERVICE = Symbol('MARKETPLACE_OFFER_COUNTERS_SERVICE');

/**
 * Story 3.4: backend ведёт `quantity_available` / `quantity_blocked` /
 * `quantity_consumed` на Offer'е при операциях с Order'ом.
 *
 * Точка интеграции с Эпиком 4 (`o.mkt.lock` / `o.mkt.unblock` /
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
 * Остаток по упаковкам: при отпуске упаковкой те же дельты идут и по
 * заказанной упаковке (`pkg` — идентификатор и число упаковок), в той же
 * команде, что и счётчики предложения. Нехватку проверяет упаковка, а не
 * котёл базовых единиц.
 *
 * `EventEmitter2` пингует канал `marketplace.offer.counters.changed`
 * после успешной операции — Story 3.5 каталог / offerer-вкладка
 * «Активность» подписываются (Phase 2 GraphQL subscription).
 */
@Injectable()
export class MarketplaceOfferCountersService {
  public static readonly EVENT_CHANGED = MARKETPLACE_OFFER_COUNTERS_CHANGED_EVENT;

  constructor(
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly repo: MarketplaceOfferDomainRepository,
    private readonly eventBus: EventEmitter2
  ) {}

  async onOrderBlocked(offer_id: string, qty: number, pkg?: OfferPackageDelta): Promise<MarketplaceOfferDomainEntity> {
    this.assertPositive(qty, pkg);
    const result = await this.repo.applyBlockDelta(offer_id, qty, pkg);
    if (!result.ok || !result.offer) {
      this.throwForReason(result.reason, offer_id, 'block', qty);
    }
    this.emit(result.offer!, 'block', qty, pkg);
    return result.offer!;
  }

  async onOrderUnblocked(offer_id: string, qty: number, pkg?: OfferPackageDelta): Promise<MarketplaceOfferDomainEntity> {
    this.assertPositive(qty, pkg);
    const result = await this.repo.applyUnblockDelta(offer_id, qty, pkg);
    if (!result.ok || !result.offer) {
      this.throwForReason(result.reason, offer_id, 'unblock', qty);
    }
    this.emit(result.offer!, 'unblock', qty, pkg);
    return result.offer!;
  }

  async onOrderConsumed(offer_id: string, qty: number, pkg?: OfferPackageDelta): Promise<MarketplaceOfferDomainEntity> {
    this.assertPositive(qty, pkg);
    const result = await this.repo.applyConsumeDelta(offer_id, qty, pkg);
    if (!result.ok || !result.offer) {
      this.throwForReason(result.reason, offer_id, 'consume', qty);
    }
    this.emit(result.offer!, 'consume', qty, pkg);
    return result.offer!;
  }

  /**
   * Корректировка «факт меньше заказа» (FR23) — разница K возвращается
   * на available. Семантически = unblock на разницу.
   */
  async onOrderAdjusted(
    offer_id: string,
    qty_diff: number,
    pkg?: OfferPackageDelta
  ): Promise<MarketplaceOfferDomainEntity> {
    return this.onOrderUnblocked(offer_id, qty_diff, pkg);
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
  async onOrderRolledBack(offer_id: string, qty: number, pkg?: OfferPackageDelta): Promise<MarketplaceOfferDomainEntity> {
    this.assertPositive(qty, pkg);
    const result = await this.repo.applyRollbackDelta(offer_id, qty, pkg);
    if (!result.ok || !result.offer) {
      this.throwForReason(result.reason, offer_id, 'rollback', qty);
    }
    this.emit(result.offer!, 'rollback', qty, pkg);
    return result.offer!;
  }

  /**
   * Базовое количество бывает дробным (0,5 кг по мере — FR7c), число
   * упаковок — только целым.
   */
  private assertPositive(qty: number, pkg?: OfferPackageDelta): void {
    if (!Number.isFinite(qty) || qty <= 0) {
      throw DomainError.badRequest('MARKETPLACE_QUANTITY_MUST_BE_POSITIVE');
    }
    if (pkg && (!Number.isInteger(pkg.count) || pkg.count <= 0)) {
      throw DomainError.badRequest('MARKETPLACE_PACKAGE_COUNT_INVALID');
    }
  }

  private throwForReason(
    reason: string | undefined,
    _offer_id: string,
    op: string,
    qty: number
  ): never {
    switch (reason) {
      case 'offer_not_found':
        throw DomainError.notFound('MARKETPLACE_OFFER_NOT_FOUND');
      case 'offer_not_active':
        throw DomainError.badRequest('MARKETPLACE_OFFER_COUNTER_INACTIVE');
      case 'insufficient_available':
        throw DomainError.badRequest('MARKETPLACE_OFFER_FREE_QUANTITY_INSUFFICIENT', { qty });
      case 'insufficient_blocked':
        throw DomainError.badRequest('MARKETPLACE_OFFER_RESERVED_QUANTITY_INSUFFICIENT', { qty });
      default:
        throw DomainError.badRequest('MARKETPLACE_OFFER_COUNTER_OPERATION_FAILED', { operation: op, qty });
    }
  }

  private emit(
    offer: MarketplaceOfferDomainEntity,
    op: 'block' | 'unblock' | 'consume' | 'rollback',
    qty: number,
    pkg?: OfferPackageDelta
  ): void {
    this.eventBus.emit(MarketplaceOfferCountersService.EVENT_CHANGED, {
      offer_id: offer.id,
      supplier_account: offer.supplier_account,
      op,
      qty,
      package: pkg ?? null,
      quantity_available: offer.quantity_available,
      quantity_blocked: offer.quantity_blocked,
      quantity_consumed: offer.quantity_consumed,
      unlimited_flag: offer.unlimited_flag,
      packages: (offer.packages ?? []).map((p) => ({
        id: p.id,
        quantity_available: p.quantity_available ?? 0,
        quantity_blocked: p.quantity_blocked ?? 0,
        quantity_consumed: p.quantity_consumed ?? 0,
      })),
    });
  }
}
