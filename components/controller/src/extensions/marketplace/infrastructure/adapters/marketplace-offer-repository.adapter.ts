import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import type {
  MarketplaceOfferDomainRepository,
  OfferCountersDeltaResult,
  OfferCreateInput,
  OfferListFilter,
  OfferUpdateInput,
} from '../../domain/repositories/marketplace-offer.repository';
import type { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';
import {
  MarketplaceOfferStatuses,
  type MarketplaceOfferStatus,
} from '../../domain/entities/marketplace-offer.types';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import { MarketplaceOfferEntity } from '../entities/marketplace-offer.entity';
import { MarketplaceOfferMapper } from '../mappers/marketplace-offer.mapper';

@Injectable()
export class MarketplaceOfferRepositoryAdapter implements MarketplaceOfferDomainRepository {
  constructor(
    @InjectRepository(MarketplaceOfferEntity, 'marketplace')
    private readonly repo: Repository<MarketplaceOfferEntity>,
    private readonly mapper: MarketplaceOfferMapper
  ) {}

  async findById(id: string): Promise<MarketplaceOfferDomainEntity | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByIds(ids: string[]): Promise<MarketplaceOfferDomainEntity[]> {
    if (ids.length === 0) return [];
    const rows = await this.repo.find({ where: { id: In(ids) } });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async list(
    filter: OfferListFilter,
    pagination: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<MarketplaceOfferDomainEntity>> {
    const qb = this.repo
      .createQueryBuilder('o')
      .where('o.coopname = :coop', { coop: filter.coopname });

    if (filter.supplier_account) {
      qb.andWhere('o.supplier_account = :supplier', { supplier: filter.supplier_account });
    }

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      qb.andWhere('o.status IN (:...statuses)', { statuses });
    }

    if (filter.category_id !== undefined) {
      qb.andWhere('o.category_id = :cat', { cat: filter.category_id });
    }

    if (filter.available_only) {
      qb.andWhere('(o.unlimited_flag = true OR o.quantity_available > 0)');
    }

    // Story 16.3: КУ-доступность — оффер виден на КУ, если его delivery_points
    // содержит объект с этим braname (jsonb containment @>).
    if (filter.delivery_braname) {
      qb.andWhere('o.delivery_points @> :dp', {
        dp: JSON.stringify([{ braname: filter.delivery_braname }]),
      });
    }

    const sortColumn = MarketplaceOfferRepositoryAdapter.resolveSortColumn(pagination.sortBy);
    qb.orderBy(sortColumn, pagination.sortOrder);
    if (sortColumn !== 'o.created_at') {
      qb.addOrderBy('o.created_at', 'DESC');
    }

    const { page, limit } = pagination;
    qb.skip((page - 1) * limit).take(limit);

    const [rows, totalCount] = await qb.getManyAndCount();
    return {
      items: rows.map((r) => this.mapper.toDomain(r)),
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  }

  private static resolveSortColumn(sortBy: string | undefined): string {
    switch (sortBy) {
      case 'price_per_unit':
      case 'price':
        return 'o.price_per_unit';
      case 'product_name':
        return 'o.product_name';
      case 'created_at':
      default:
        return 'o.created_at';
    }
  }

  async countByCategory(
    coopname: string,
    delivery_braname?: string | null
  ): Promise<Map<number, number>> {
    const qb = this.repo
      .createQueryBuilder('o')
      .select('o.category_id', 'category_id')
      .addSelect('COUNT(*)', 'cnt')
      .where('o.coopname = :coop', { coop: coopname })
      .andWhere('o.status = :s', { s: MarketplaceOfferStatuses.ACTIVE })
      .andWhere('(o.unlimited_flag = true OR o.quantity_available > 0)');

    // КУ-доступность: счётчики скоупим тем же jsonb-containment, что и витрина
    // (см. list), иначе категория «есть» по кооперативу, но пуста на пункте.
    if (delivery_braname) {
      qb.andWhere('o.delivery_points @> :dp', {
        dp: JSON.stringify([{ braname: delivery_braname }]),
      });
    }

    const rows = await qb
      .groupBy('o.category_id')
      .getRawMany<{ category_id: string; cnt: string }>();

    const result = new Map<number, number>();
    for (const r of rows) {
      result.set(Number(r.category_id), Number(r.cnt));
    }
    return result;
  }

  async countRecentCreatedBy(supplier_account: string, sinceMs: number): Promise<number> {
    const since = new Date(Date.now() - sinceMs);
    return this.repo.count({
      where: { supplier_account, created_at: MoreThanOrEqual(since) },
    });
  }

  async create(input: OfferCreateInput): Promise<MarketplaceOfferDomainEntity> {
    const row = this.repo.create({
      coopname: input.coopname,
      supplier_account: input.supplier_account,
      vitrine_id: input.vitrine_id,
      product_name: input.product_name,
      description: input.description,
      category_id: input.category_id,
      price_per_unit: input.price_per_unit,
      unit_of_measure: input.unit_of_measure,
      order_unit_size: input.order_unit_size,
      quantity_available: input.unlimited_flag ? 0 : input.quantity_available,
      quantity_blocked: 0,
      quantity_consumed: 0,
      unlimited_flag: input.unlimited_flag,
      delivery_points: input.delivery_points ?? [],
      shelf_life_days: input.shelf_life_days,
      warranty_days: input.warranty_days,
      barcode_strategy: input.barcode_strategy,
      pack_size: input.pack_size,
      images: input.images ?? [],
      stock_braname: input.stock_braname ?? null,
      stock_origin_offer_id: input.stock_origin_offer_id ?? null,
      // Оффер кооператива из остатка публикуется оператором сразу ACTIVE —
      // модерация председателем для остатка не применяется (requirement 76,
      // открытый вопрос 8: если решат модерировать — заменить на
      // PENDING_MODERATION).
      status: input.stock_braname
        ? MarketplaceOfferStatuses.ACTIVE
        : MarketplaceOfferStatuses.PENDING_MODERATION,
    });
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async applyUpdate(
    id: string,
    patch: OfferUpdateInput & {
      status?: MarketplaceOfferStatus;
      approved_by?: string | null;
      approved_at?: Date | null;
      rejected_by?: string | null;
      rejected_at?: Date | null;
      reject_reason?: string | null;
    }
  ): Promise<MarketplaceOfferDomainEntity> {
    await this.repo.update({ id }, patch as Record<string, unknown>);
    const row = await this.repo.findOneOrFail({ where: { id } });
    return this.mapper.toDomain(row);
  }

  async applyBlockDelta(offer_id: string, qty: number): Promise<OfferCountersDeltaResult> {
    if (qty <= 0) return { ok: false, reason: 'insufficient_available' };
    const result = await this.repo.query(
      `UPDATE marketplace_offer
         SET quantity_blocked = quantity_blocked + $2,
             quantity_available = CASE
               WHEN unlimited_flag THEN quantity_available
               ELSE quantity_available - $2
             END,
             updated_at = NOW()
       WHERE id = $1
         AND status = 'ACTIVE'
         AND (unlimited_flag = true OR quantity_available >= $2)
       RETURNING *`,
      [offer_id, qty]
    );
    return this.interpretDelta(result, offer_id, 'insufficient_available');
  }

  async applyUnblockDelta(offer_id: string, qty: number): Promise<OfferCountersDeltaResult> {
    if (qty <= 0) return { ok: false, reason: 'insufficient_blocked' };
    const result = await this.repo.query(
      `UPDATE marketplace_offer
         SET quantity_blocked = quantity_blocked - $2,
             quantity_available = CASE
               WHEN unlimited_flag THEN quantity_available
               ELSE quantity_available + $2
             END,
             updated_at = NOW()
       WHERE id = $1
         AND quantity_blocked >= $2
       RETURNING *`,
      [offer_id, qty]
    );
    return this.interpretDelta(result, offer_id, 'insufficient_blocked');
  }

  async applyConsumeDelta(offer_id: string, qty: number): Promise<OfferCountersDeltaResult> {
    if (qty <= 0) return { ok: false, reason: 'insufficient_blocked' };
    const result = await this.repo.query(
      `UPDATE marketplace_offer
         SET quantity_blocked = quantity_blocked - $2,
             quantity_consumed = quantity_consumed + $2,
             updated_at = NOW()
       WHERE id = $1
         AND quantity_blocked >= $2
       RETURNING *`,
      [offer_id, qty]
    );
    return this.interpretDelta(result, offer_id, 'insufficient_blocked');
  }

  async applyRollbackDelta(offer_id: string, qty: number): Promise<OfferCountersDeltaResult> {
    if (qty <= 0) return { ok: false, reason: 'insufficient_blocked' };
    // ADR-005: rollback без CAS — counter может уйти в отрицательное
    // значение при rollback Order'а, который уже перешёл в consumed.
    // Это ожидаемо при катастрофе fork-вне-Rollback-Horizon; fix через
    // manual reconciliation (FR12 ARCH-sync).
    const result = await this.repo.query(
      `UPDATE marketplace_offer
         SET quantity_blocked = quantity_blocked - $2,
             quantity_available = CASE
               WHEN unlimited_flag THEN quantity_available
               ELSE quantity_available + $2
             END,
             updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [offer_id, qty]
    );
    return this.interpretDelta(result, offer_id, 'insufficient_blocked');
  }

  /**
   * pg native driver через TypeORM возвращает результат `query` для UPDATE
   * RETURNING как `[rows, count]` массив — нормализуем.
   */
  private async interpretDelta(
    result: unknown,
    offer_id: string,
    failureReason: 'insufficient_available' | 'insufficient_blocked'
  ): Promise<OfferCountersDeltaResult> {
    const rows = Array.isArray(result) ? (result[0] ?? result) : [];
    const updatedRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

    if (!updatedRow) {
      const existing = await this.repo.findOne({ where: { id: offer_id } });
      if (!existing) return { ok: false, reason: 'offer_not_found' };
      if (failureReason === 'insufficient_available' && existing.status !== MarketplaceOfferStatuses.ACTIVE) {
        return { ok: false, reason: 'offer_not_active' };
      }
      return { ok: false, reason: failureReason };
    }

    // pg возвращает column-by-column как plain object; нормализуем через
    // повторный findOne для прохода mapper (timestamp coercion, типизация).
    const offer = await this.repo.findOneOrFail({ where: { id: offer_id } });
    return { ok: true, offer: this.mapper.toDomain(offer) };
  }
}
