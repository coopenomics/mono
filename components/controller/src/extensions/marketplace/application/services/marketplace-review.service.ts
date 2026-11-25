import { Inject, Injectable } from '@nestjs/common';
import { DomainError, type PaginationInputDTO, type PaginationResult } from '@coopenomics/extension-kit';
import { MarketplaceOrderStatuses, type MarketplaceOrderStatus } from '../../domain/entities/marketplace-order.types';
import type { MarketplaceReviewDomainEntity } from '../../domain/entities/marketplace-review.entity';
import {
  MARKETPLACE_REVIEW_HIDDEN_REASON_MAX,
  MARKETPLACE_REVIEW_NO_RATING,
  MARKETPLACE_REVIEW_STARS_MAX,
  MARKETPLACE_REVIEW_STARS_MIN,
  MARKETPLACE_REVIEW_TEXT_MAX,
  MarketplaceReviewStatuses,
  type MarketplaceReviewRating,
  type MarketplaceReviewStatus,
  type MarketplaceReviewSummary,
} from '../../domain/entities/marketplace-review.types';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_REVIEW_REPOSITORY,
  type MarketplaceReviewDomainRepository,
  type ReviewSummaryTarget,
} from '../../domain/repositories/marketplace-review.repository';

/** Отзыв пишется по заказу, имущество по которому заказчик получил; возврат после выдачи — тоже опыт. */
const REVIEWABLE_ORDER_STATUSES: ReadonlySet<MarketplaceOrderStatus> = new Set([
  MarketplaceOrderStatuses.RECEIVED,
  MarketplaceOrderStatuses.RETURNED,
]);

const PG_UNIQUE_VIOLATION = '23505';

export interface ReviewListQuery {
  coopname: string;
  offer_id?: string | null;
  supplier_account?: string | null;
  author_account?: string | null;
  search?: string | null;
  /** Показать и скрытые отзывы; действует только у того, кто вправе их модерировать. */
  include_hidden?: boolean | null;
  /** Отбор по статусу — вместе с `include_hidden`, для реестра администратора. */
  status?: MarketplaceReviewStatus | null;
}

interface PendingRatings {
  offer_ids: Set<string>;
  result: Promise<Map<string, MarketplaceReviewRating>>;
}

/**
 * Отзывы заказчиков о полученном имуществе (задача 598-61).
 *
 * Отзыв привязан к заказу: заказ — одна позиция предложения, поэтому на заказ
 * отзыв один, а написать его может только заказчик после получения. Отзыв
 * публикуется сразу; администратор скрывает его постфактум с причиной.
 * Сводные оценки считаются только по опубликованным отзывам.
 */
@Injectable()
export class MarketplaceReviewService {
  /** Запросы сводных оценок одного прохода обработки собираются в один запрос к базе. */
  private readonly pendingRatings = new Map<string, PendingRatings>();

  constructor(
    @Inject(MARKETPLACE_REVIEW_REPOSITORY)
    private readonly reviews: MarketplaceReviewDomainRepository,
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orders: MarketplaceOrderDomainRepository
  ) {}

  async create(input: {
    coopname: string;
    author_account: string;
    order_id: string;
    stars: number;
    text?: string | null;
  }): Promise<MarketplaceReviewDomainEntity> {
    const stars = normalizeStars(input.stars);
    const text = normalizeText(input.text);

    const order = await this.orders.findById(input.order_id);
    if (!order || order.coopname !== input.coopname) {
      throw DomainError.notFound('MARKETPLACE_REVIEW_ORDER_NOT_FOUND');
    }
    if (order.orderer_account !== input.author_account) {
      throw DomainError.forbidden('MARKETPLACE_REVIEW_FOREIGN_ORDER');
    }
    if (!REVIEWABLE_ORDER_STATUSES.has(order.status)) {
      throw DomainError.unprocessable('MARKETPLACE_REVIEW_ORDER_NOT_RECEIVED');
    }
    if (await this.reviews.findByOrder(input.coopname, order.id)) {
      throw DomainError.conflict('MARKETPLACE_REVIEW_ALREADY_EXISTS');
    }

    try {
      return await this.reviews.create({
        coopname: input.coopname,
        order_id: order.id,
        offer_id: order.offer_id,
        supplier_account: order.supplier_account,
        author_account: input.author_account,
        stars,
        text,
      });
    } catch (error) {
      // Двойное нажатие: второй запрос прошёл проверку раньше, чем первый записал отзыв.
      if (String((error as { code?: unknown } | null)?.code) === PG_UNIQUE_VIOLATION) {
        throw DomainError.conflict('MARKETPLACE_REVIEW_ALREADY_EXISTS');
      }
      throw error;
    }
  }

  async updateMine(input: {
    coopname: string;
    author_account: string;
    id: string;
    stars: number;
    text?: string | null;
  }): Promise<MarketplaceReviewDomainEntity> {
    const stars = normalizeStars(input.stars);
    const text = normalizeText(input.text);

    const review = await this.findOwn(input.coopname, input.id);
    if (review.author_account !== input.author_account) {
      throw DomainError.forbidden('MARKETPLACE_REVIEW_FOREIGN');
    }
    if (review.status === MarketplaceReviewStatuses.HIDDEN) {
      throw DomainError.unprocessable('MARKETPLACE_REVIEW_HIDDEN_NOT_EDITABLE');
    }
    return this.reviews.updateContent(review.id, { stars, text });
  }

  /** Администратор скрывает отзыв с причиной либо возвращает его в публикацию. */
  async setStatus(input: {
    coopname: string;
    actor_account: string;
    id: string;
    status: MarketplaceReviewStatus;
    reason?: string | null;
    now?: Date;
  }): Promise<MarketplaceReviewDomainEntity> {
    const review = await this.findOwn(input.coopname, input.id);

    if (input.status === MarketplaceReviewStatuses.HIDDEN) {
      const reason = (input.reason ?? '').trim();
      if (!reason) throw DomainError.badRequest('MARKETPLACE_REVIEW_HIDE_REASON_REQUIRED');
      if (reason.length > MARKETPLACE_REVIEW_HIDDEN_REASON_MAX) {
        throw DomainError.badRequest('MARKETPLACE_REVIEW_HIDE_REASON_TOO_LONG', {
          max: MARKETPLACE_REVIEW_HIDDEN_REASON_MAX,
        });
      }
      return this.reviews.setStatus(review.id, {
        status: MarketplaceReviewStatuses.HIDDEN,
        hidden_by: input.actor_account,
        hidden_at: input.now ?? new Date(),
        hidden_reason: reason,
      });
    }

    if (review.status === MarketplaceReviewStatuses.PUBLISHED) return review;
    return this.reviews.setStatus(review.id, {
      status: MarketplaceReviewStatuses.PUBLISHED,
      hidden_by: null,
      hidden_at: null,
      hidden_reason: null,
    });
  }

  /**
   * Список отзывов. Скрытые видит только тот, кто вправе их модерировать и
   * прямо об этом попросил; остальным — только опубликованные. Свой скрытый
   * отзыв автор видит в заказе (`findMineByOrder`).
   */
  list(
    query: ReviewListQuery,
    pagination: PaginationInputDTO,
    viewer: { can_moderate: boolean }
  ): Promise<PaginationResult<MarketplaceReviewDomainEntity>> {
    const seesHidden = viewer.can_moderate && query.include_hidden === true;
    return this.reviews.list(
      {
        coopname: query.coopname,
        offer_id: query.offer_id ?? undefined,
        supplier_account: query.supplier_account ?? undefined,
        author_account: query.author_account ?? undefined,
        search: query.search ?? undefined,
        status: seesHidden ? query.status ?? undefined : MarketplaceReviewStatuses.PUBLISHED,
      },
      pagination
    );
  }

  /** Отзыв заказчика по его заказу — в любом статусе; чужой заказ отзыва не отдаёт. */
  async findMineByOrder(
    coopname: string,
    author_account: string,
    order_id: string
  ): Promise<MarketplaceReviewDomainEntity | null> {
    const review = await this.reviews.findByOrder(coopname, order_id);
    return review && review.author_account === author_account ? review : null;
  }

  summary(coopname: string, target: ReviewSummaryTarget): Promise<MarketplaceReviewSummary> {
    return this.reviews.summary(coopname, target);
  }

  /**
   * Сводная оценка предложения. Каталог спрашивает её у каждой карточки
   * страницы: обращения одного прохода складываются в один запрос к базе.
   */
  ratingOfOffer(coopname: string, offer_id: string): Promise<MarketplaceReviewRating> {
    let pending = this.pendingRatings.get(coopname);
    if (!pending) {
      const offer_ids = new Set<string>();
      const result = afterCurrentPass().then(() => {
        this.pendingRatings.delete(coopname);
        return this.reviews.ratingsByOffers(coopname, [...offer_ids]);
      });
      pending = { offer_ids, result };
      this.pendingRatings.set(coopname, pending);
    }
    pending.offer_ids.add(offer_id);
    return pending.result.then((ratings) => ratings.get(offer_id) ?? MARKETPLACE_REVIEW_NO_RATING);
  }

  private async findOwn(coopname: string, id: string): Promise<MarketplaceReviewDomainEntity> {
    const review = await this.reviews.findById(id);
    if (!review || review.coopname !== coopname) throw DomainError.notFound('MARKETPLACE_REVIEW_NOT_FOUND');
    return review;
  }
}

/**
 * Момент, когда текущий проход обработки запроса закончил ставить обращения:
 * очередь обещаний исчерпана. Так же собирает пачку DataLoader.
 */
function afterCurrentPass(): Promise<void> {
  return new Promise((resolve) => {
    void Promise.resolve().then(() => process.nextTick(resolve));
  });
}

function normalizeStars(stars: number): number {
  if (!Number.isInteger(stars) || stars < MARKETPLACE_REVIEW_STARS_MIN || stars > MARKETPLACE_REVIEW_STARS_MAX) {
    throw DomainError.badRequest('MARKETPLACE_REVIEW_STARS_OUT_OF_RANGE', {
      min: MARKETPLACE_REVIEW_STARS_MIN,
      max: MARKETPLACE_REVIEW_STARS_MAX,
    });
  }
  return stars;
}

function normalizeText(text: string | null | undefined): string {
  const value = (text ?? '').trim();
  if (value.length > MARKETPLACE_REVIEW_TEXT_MAX) {
    throw DomainError.badRequest('MARKETPLACE_REVIEW_TEXT_TOO_LONG', { max: MARKETPLACE_REVIEW_TEXT_MAX });
  }
  return value;
}
