import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import {
  MARKETPLACE_MODERATION_LOG_REPOSITORY,
  type MarketplaceModerationLogDomainRepository,
} from '../../domain/repositories/marketplace-moderation-log.repository';
import type { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';
import type { MarketplaceModerationLogDomainEntity } from '../../domain/entities/marketplace-moderation-log.entity';

export const MARKETPLACE_MODERATION_SERVICE = Symbol('MARKETPLACE_MODERATION_SERVICE');

/**
 * Story 3.3: модерация Offer'ов админом.
 *
 * Транзакционно: applyUpdate(offer) → append(log); порядок save→emit pubsub
 * соответствует INV-12 controller/CLAUDE.md (никогда emit до save).
 *
 * Pubsub-канал per-extension: `marketplace.offer.{approved|rejected}` —
 * под GraphQL Subscription / in-app notifications (UX-DR38) listener'ы.
 * Сам emit сейчас идёт через `EventEmitter2` (core-bus); конкретная
 * подписка/Subscription resolver — Phase 2 (notifications не входят в
 * scope Эпика 3 / тек. PR).
 */
@Injectable()
export class MarketplaceModerationService {
  public static readonly MAX_REJECT_REASON_LEN = 1000;
  public static readonly EVENT_APPROVED = 'marketplace.offer.approved';
  public static readonly EVENT_REJECTED = 'marketplace.offer.rejected';

  constructor(
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly offerRepo: MarketplaceOfferDomainRepository,
    @Inject(MARKETPLACE_MODERATION_LOG_REPOSITORY)
    private readonly logRepo: MarketplaceModerationLogDomainRepository,
    private readonly eventBus: EventEmitter2
  ) {}

  async listPending(
    cooperative_id: string,
    paging: { limit: number; offset: number }
  ) {
    return this.offerRepo.list(
      { cooperative_id, status: 'PENDING_MODERATION' },
      { ...paging, sort: 'created_at_desc' }
    );
  }

  async approve(offer_id: string, admin_account: string): Promise<MarketplaceOfferDomainEntity> {
    const offer = await this.requirePending(offer_id);
    const updated = await this.offerRepo.applyUpdate(offer.id, {
      status: 'ACTIVE',
      approved_by: admin_account,
      approved_at: new Date(),
      rejected_by: null,
      rejected_at: null,
      reject_reason: null,
    });
    await this.logRepo.append({
      offer_id: offer.id,
      action: 'approve',
      by_account: admin_account,
      reason: null,
    });
    this.eventBus.emit(MarketplaceModerationService.EVENT_APPROVED, {
      offer_id: offer.id,
      supplier_account: offer.supplier_account,
      approved_by: admin_account,
    });
    return updated;
  }

  async reject(
    offer_id: string,
    admin_account: string,
    reason: string
  ): Promise<MarketplaceOfferDomainEntity> {
    const trimmed = reason?.trim();
    if (!trimmed) {
      throw new BadRequestException('reject_reason обязателен и не может быть пустой строкой');
    }
    if (trimmed.length > MarketplaceModerationService.MAX_REJECT_REASON_LEN) {
      throw new BadRequestException(
        `reject_reason должен быть ≤${MarketplaceModerationService.MAX_REJECT_REASON_LEN} символов`
      );
    }
    const offer = await this.requirePending(offer_id);
    const now = new Date();
    const updated = await this.offerRepo.applyUpdate(offer.id, {
      status: 'REJECTED',
      rejected_by: admin_account,
      rejected_at: now,
      reject_reason: trimmed,
    });
    await this.logRepo.append({
      offer_id: offer.id,
      action: 'reject',
      by_account: admin_account,
      reason: trimmed,
    });
    this.eventBus.emit(MarketplaceModerationService.EVENT_REJECTED, {
      offer_id: offer.id,
      supplier_account: offer.supplier_account,
      rejected_by: admin_account,
      reason: trimmed,
    });
    return updated;
  }

  async listLog(offer_id: string): Promise<MarketplaceModerationLogDomainEntity[]> {
    return this.logRepo.listByOffer(offer_id);
  }

  private async requirePending(offer_id: string): Promise<MarketplaceOfferDomainEntity> {
    const offer = await this.offerRepo.findById(offer_id);
    if (!offer) {
      throw new NotFoundException(`Offer ${offer_id} не найден`);
    }
    if (offer.status !== 'PENDING_MODERATION') {
      throw new ConflictException(
        `Offer ${offer_id} в статусе ${offer.status}, модерация недопустима (требуется PENDING_MODERATION)`
      );
    }
    return offer;
  }
}
