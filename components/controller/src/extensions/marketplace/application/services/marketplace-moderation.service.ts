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
import {
  MarketplaceOfferStatuses,
  type MarketplaceOfferStatus,
} from '../../domain/entities/marketplace-offer.types';
import type { MarketplaceModerationLogDomainEntity } from '../../domain/entities/marketplace-moderation-log.entity';
import {
  MARKETPLACE_OFFER_APPROVED_EVENT,
  MARKETPLACE_OFFER_REJECTED_EVENT,
} from '../events/marketplace-notification.events';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';

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
  public static readonly EVENT_APPROVED = MARKETPLACE_OFFER_APPROVED_EVENT;
  public static readonly EVENT_REJECTED = MARKETPLACE_OFFER_REJECTED_EVENT;

  constructor(
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly offerRepo: MarketplaceOfferDomainRepository,
    @Inject(MARKETPLACE_MODERATION_LOG_REPOSITORY)
    private readonly logRepo: MarketplaceModerationLogDomainRepository,
    private readonly eventBus: EventEmitter2
  ) {}

  async listPending(
    coopname: string,
    pagination: PaginationInputDTO
  ): Promise<PaginationResult<MarketplaceOfferDomainEntity>> {
    return this.offerRepo.list({ coopname, status: MarketplaceOfferStatuses.PENDING_MODERATION }, pagination);
  }

  async approve(
    offer_id: string,
    admin_account: string,
    warranty_days: number
  ): Promise<MarketplaceOfferDomainEntity> {
    if (!Number.isInteger(warranty_days) || warranty_days < 0) {
      throw new BadRequestException('Гарантийный срок возврата должен быть целым неотрицательным числом дней.');
    }
    const offer = await this.requirePending(offer_id);
    // Гарантийный срок возврата задаёт модератор именно на одобрении: питает
    // on-chain `warranty_until` заказа (окно возврата). Срок годности для
    // скоропорта — отдельное поле `shelf_life_days`, его поставил поставщик.
    const updated = await this.offerRepo.applyUpdate(offer.id, {
      status: MarketplaceOfferStatuses.ACTIVE,
      warranty_days,
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
      category_id: offer.category_id,
      coopname: offer.coopname,
      product_name: offer.product_name,
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
      throw new BadRequestException('Укажите причину отклонения предложения.');
    }
    if (trimmed.length > MarketplaceModerationService.MAX_REJECT_REASON_LEN) {
      throw new BadRequestException(
        `Причина отклонения слишком длинная (максимум ${MarketplaceModerationService.MAX_REJECT_REASON_LEN} символов).`
      );
    }
    const offer = await this.requirePending(offer_id);
    const now = new Date();
    const updated = await this.offerRepo.applyUpdate(offer.id, {
      status: MarketplaceOfferStatuses.REJECTED,
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
      coopname: offer.coopname,
      product_name: offer.product_name,
    });
    return updated;
  }

  /**
   * Правка гарантийного срока возврата уже одобренного предложения. Отдельно
   * от `approve`, потому что модератор может пересмотреть срок после публикации
   * без повторной модерации содержимого. Влияет только на будущие заказы (у
   * контракта `warranty_until` фиксируется на выдаче каждого заказа).
   */
  async setWarranty(
    offer_id: string,
    admin_account: string,
    warranty_days: number
  ): Promise<MarketplaceOfferDomainEntity> {
    if (!Number.isInteger(warranty_days) || warranty_days < 0) {
      throw new BadRequestException('Гарантийный срок возврата должен быть целым неотрицательным числом дней.');
    }
    const offer = await this.offerRepo.findById(offer_id);
    if (!offer) {
      throw new NotFoundException('Предложение не найдено.');
    }
    const updated = await this.offerRepo.applyUpdate(offer.id, { warranty_days });
    await this.logRepo.append({
      offer_id: offer.id,
      action: 'set_warranty',
      by_account: admin_account,
      reason: `Гарантийный срок возврата: ${warranty_days} дн.`,
    });
    return updated;
  }

  async listLog(offer_id: string): Promise<MarketplaceModerationLogDomainEntity[]> {
    return this.logRepo.listByOffer(offer_id);
  }

  private async requirePending(offer_id: string): Promise<MarketplaceOfferDomainEntity> {
    const offer = await this.offerRepo.findById(offer_id);
    if (!offer) {
      throw new NotFoundException('Предложение не найдено.');
    }
    if (offer.status !== MarketplaceOfferStatuses.PENDING_MODERATION) {
      const statusLabel = MarketplaceModerationService.translateStatus(offer.status);
      throw new ConflictException(
        `Это предложение уже ${statusLabel} — модерация недоступна.`
      );
    }
    return offer;
  }

  private static translateStatus(status: MarketplaceOfferStatus): string {
    switch (status) {
      case MarketplaceOfferStatuses.ACTIVE:
        return 'одобрено';
      case MarketplaceOfferStatuses.REJECTED:
        return 'отклонено';
      case MarketplaceOfferStatuses.WITHDRAWN:
        return 'снято с публикации';
      default:
        return `в статусе «${status}»`;
    }
  }
}
