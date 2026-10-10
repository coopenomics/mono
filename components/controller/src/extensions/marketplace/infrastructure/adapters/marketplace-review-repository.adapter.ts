import {
  TableStore,
  ilike,
  type FindOptions,
  type PaginationInputDTO,
  type PaginationResult,
} from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { MarketplaceReviewDomainEntity } from '../../domain/entities/marketplace-review.entity';
import {
  MARKETPLACE_REVIEW_STARS_MAX,
  MARKETPLACE_REVIEW_STARS_MIN,
  MarketplaceReviewStatuses,
  type MarketplaceReviewRating,
  type MarketplaceReviewStatus,
  type MarketplaceReviewSummary,
} from '../../domain/entities/marketplace-review.types';
import type {
  MarketplaceReviewDomainRepository,
  ReviewCreateInput,
  ReviewListFilter,
  ReviewSummaryTarget,
} from '../../domain/repositories/marketplace-review.repository';
import { MARKETPLACE_REVIEW_STORE } from '../database/marketplace-stores';
import { MarketplaceReviewEntity } from '../entities/marketplace-review.entity';

/** Поля, по которым список отзывов разрешено сортировать. */
const SORT_FIELDS = ['created_at', 'updated_at', 'stars'] as const;
type SortField = (typeof SORT_FIELDS)[number];

/** Средняя оценка до десятых: так её показывает стол («4,8»). */
function roundRating(value: unknown): number | null {
  const avg = Number(value);
  return Number.isFinite(avg) && avg > 0 ? Math.round(avg * 10) / 10 : null;
}

/** Знаки подстановки в подстроке поиска считаются обычными символами. */
function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

@Injectable()
export class MarketplaceReviewRepositoryAdapter implements MarketplaceReviewDomainRepository {
  constructor(
    @Inject(MARKETPLACE_REVIEW_STORE)
    private readonly repo: TableStore<MarketplaceReviewEntity>
  ) {}

  async findById(id: string): Promise<MarketplaceReviewDomainEntity | null> {
    const row = await this.repo.findOne({ id });
    return row ? toDomain(row) : null;
  }

  async findByOrder(coopname: string, order_id: string): Promise<MarketplaceReviewDomainEntity | null> {
    const row = await this.repo.findOne({ coopname, order_id });
    return row ? toDomain(row) : null;
  }

  async create(input: ReviewCreateInput): Promise<MarketplaceReviewDomainEntity> {
    return toDomain(await this.repo.insert({ ...input, status: MarketplaceReviewStatuses.PUBLISHED }));
  }

  async updateContent(id: string, patch: { stars: number; text: string }): Promise<MarketplaceReviewDomainEntity> {
    await this.repo.update({ id }, patch);
    return toDomain(await this.repo.findOneOrFail({ id }));
  }

  async setStatus(
    id: string,
    patch: { status: MarketplaceReviewStatus; hidden_by: string | null; hidden_at: Date | null; hidden_reason: string | null }
  ): Promise<MarketplaceReviewDomainEntity> {
    await this.repo.update({ id }, patch);
    return toDomain(await this.repo.findOneOrFail({ id }));
  }

  async list(
    filter: ReviewListFilter,
    pagination: PaginationInputDTO
  ): Promise<PaginationResult<MarketplaceReviewDomainEntity>> {
    const where: Record<string, unknown> = { coopname: filter.coopname };
    if (filter.offer_id) where.offer_id = filter.offer_id;
    if (filter.supplier_account) where.supplier_account = filter.supplier_account;
    if (filter.author_account) where.author_account = filter.author_account;
    if (filter.status) where.status = filter.status;
    if (filter.search?.trim()) where.text = ilike(likePattern(filter.search.trim()));

    const sortBy: SortField = SORT_FIELDS.includes(pagination.sortBy as SortField)
      ? (pagination.sortBy as SortField)
      : 'created_at';
    const page = Math.max(1, pagination.page ?? 1);
    const limit = Math.max(1, pagination.limit ?? 10);
    const order: NonNullable<FindOptions<MarketplaceReviewEntity>['order']> = {};
    order[sortBy] = pagination.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    const [rows, totalCount] = await this.repo.findAndCount(where, { order, limit, offset: (page - 1) * limit });
    return {
      items: rows.map(toDomain),
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
      currentPage: page,
    };
  }

  async ratingsByOffers(coopname: string, offer_ids: string[]): Promise<Map<string, MarketplaceReviewRating>> {
    const result = new Map<string, MarketplaceReviewRating>();
    if (offer_ids.length === 0) return result;
    const rows = await this.repo.kysely
      .selectFrom('marketplace_review')
      .select('offer_id')
      .select((eb) => [eb.fn.countAll<string>().as('count'), eb.fn.avg<string>('stars').as('avg')])
      .where('coopname', '=', coopname)
      .where('status', '=', MarketplaceReviewStatuses.PUBLISHED)
      .where('offer_id', 'in', offer_ids)
      .groupBy('offer_id')
      .execute();
    for (const row of rows) {
      result.set(String(row.offer_id), { rating_avg: roundRating(row.avg), reviews_count: Number(row.count) });
    }
    return result;
  }

  async summary(coopname: string, target: ReviewSummaryTarget): Promise<MarketplaceReviewSummary> {
    const [column, value] =
      'offer_id' in target ? (['offer_id', target.offer_id] as const) : (['supplier_account', target.supplier_account] as const);
    const rows = await this.repo.kysely
      .selectFrom('marketplace_review')
      .select('stars')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('coopname', '=', coopname)
      .where('status', '=', MarketplaceReviewStatuses.PUBLISHED)
      .where(column, '=', value)
      .groupBy('stars')
      .execute();

    const counts = new Map<number, number>(rows.map((row) => [Number(row.stars), Number(row.count)]));
    const stars_breakdown: MarketplaceReviewSummary['stars_breakdown'] = [];
    let reviews_count = 0;
    let total = 0;
    for (let stars = MARKETPLACE_REVIEW_STARS_MAX; stars >= MARKETPLACE_REVIEW_STARS_MIN; stars -= 1) {
      const count = counts.get(stars) ?? 0;
      stars_breakdown.push({ stars, count });
      reviews_count += count;
      total += stars * count;
    }
    return {
      rating_avg: reviews_count > 0 ? roundRating(total / reviews_count) : null,
      reviews_count,
      stars_breakdown,
    };
  }
}

function toDomain(row: MarketplaceReviewEntity): MarketplaceReviewDomainEntity {
  return new MarketplaceReviewDomainEntity({
    id: row.id,
    coopname: row.coopname,
    order_id: row.order_id,
    offer_id: row.offer_id,
    supplier_account: row.supplier_account,
    author_account: row.author_account,
    stars: Number(row.stars),
    text: row.text ?? '',
    status: row.status,
    hidden_by: row.hidden_by ?? null,
    hidden_at: row.hidden_at ?? null,
    hidden_reason: row.hidden_reason ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}
