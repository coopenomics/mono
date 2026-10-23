import { TableStore, moreOrEqual, oneOf, rawQuery, sortColumn, sortDirection } from '@coopenomics/extension-kit';
import { sql, type Expression, type ExpressionBuilder, type SqlBool } from 'kysely';
import { MARKETPLACE_OFFER_STORE } from '../../infrastructure/database/marketplace-stores';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { CHAIN_CHANGES_PORT, type IChainChangesPort } from '@coopenomics/innercoop';
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
  type OfferPackageDelta,
} from '../../domain/entities/marketplace-offer.types';
import { MarketplaceOfferEntity } from '../entities/marketplace-offer.entity';
import { MarketplaceOfferMapper } from '../mappers/marketplace-offer.mapper';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';

/** Одно из четырёх движений счётчиков предложения и упаковки. */
type OfferCounterOp = 'block' | 'unblock' | 'consume' | 'rollback';

/** Счётчик упаковки в jsonb; у упаковок, заведённых до учёта по упаковкам, его нет — считаем нулём. */
const pv = (alias: string, field: string): string => `COALESCE((${alias}->>'${field}')::numeric, 0)`;

/**
 * SET и WHERE каждого движения. Предложение считается в базовых единицах ($2),
 * упаковка — в упаковках ($4) по своему идентификатору ($3); при безлимите
 * свободное не трогается ни там, ни там.
 */
const OFFER_COUNTER_SQL: Record<OfferCounterOp, { offer: string; pkg: string; where: string }> = {
  block: {
    offer: `quantity_blocked = o.quantity_blocked + $2,
            quantity_available = CASE WHEN o.unlimited_flag THEN o.quantity_available ELSE o.quantity_available - $2 END`,
    pkg: `'quantity_blocked', ${pv('p', 'quantity_blocked')} + $4,
          'quantity_available', CASE WHEN o.unlimited_flag THEN ${pv('p', 'quantity_available')} ELSE ${pv('p', 'quantity_available')} - $4 END`,
    where: `o.status = 'ACTIVE' AND (o.unlimited_flag = true OR o.quantity_available >= $2)`,
  },
  unblock: {
    offer: `quantity_blocked = o.quantity_blocked - $2,
            quantity_available = CASE WHEN o.unlimited_flag THEN o.quantity_available ELSE o.quantity_available + $2 END`,
    pkg: `'quantity_blocked', ${pv('p', 'quantity_blocked')} - $4,
          'quantity_available', CASE WHEN o.unlimited_flag THEN ${pv('p', 'quantity_available')} ELSE ${pv('p', 'quantity_available')} + $4 END`,
    where: 'o.quantity_blocked >= $2',
  },
  consume: {
    offer: `quantity_blocked = o.quantity_blocked - $2,
            quantity_consumed = o.quantity_consumed + $2`,
    pkg: `'quantity_blocked', ${pv('p', 'quantity_blocked')} - $4,
          'quantity_consumed', ${pv('p', 'quantity_consumed')} + $4`,
    where: 'o.quantity_blocked >= $2',
  },
  rollback: {
    offer: `quantity_blocked = o.quantity_blocked - $2,
            quantity_available = CASE WHEN o.unlimited_flag THEN o.quantity_available ELSE o.quantity_available + $2 END`,
    pkg: `'quantity_blocked', ${pv('p', 'quantity_blocked')} - $4,
          'quantity_available', CASE WHEN o.unlimited_flag THEN ${pv('p', 'quantity_available')} ELSE ${pv('p', 'quantity_available')} + $4 END`,
    where: '',
  },
};

/** Каталог упаковок с переписанными счётчиками одной упаковки ($3); порядок сохраняется. */
const packageRewriteSql = (fields: string): string =>
  `SELECT COALESCE(jsonb_agg(CASE WHEN p->>'id' = $3 THEN p || jsonb_build_object(${fields}) ELSE p END ORDER BY ord), '[]'::jsonb)
     FROM jsonb_array_elements(o.packages) WITH ORDINALITY AS t(p, ord)`;

/** Блокировка проходит, только если свободных упаковок именно этого вида хватает. */
const PACKAGE_AVAILABLE_GUARD_SQL = `(o.unlimited_flag = true OR EXISTS (
  SELECT 1 FROM jsonb_array_elements(o.packages) q
   WHERE q->>'id' = $3 AND ${pv('q', 'quantity_available')} >= $4))`;

type OfferConditionFilter = Pick<OfferListFilter, 'coopname' | 'supplier_account' | 'status' | 'category_id' | 'available_only'> & {
  delivery_braname?: string | null;
};

/**
 * Условия отбора предложений. Доступность на пункте выдачи: предложение видно
 * на участке, если его `delivery_points` содержит объект с этим участком.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function offerConditions(eb: ExpressionBuilder<any, any>, filter: OfferConditionFilter): Expression<SqlBool>[] {
  const conditions: Expression<SqlBool>[] = [eb('coopname', '=', filter.coopname)];
  if (filter.supplier_account) conditions.push(eb('supplier_account', '=', filter.supplier_account));
  if (filter.status) conditions.push(eb('status', 'in', Array.isArray(filter.status) ? filter.status : [filter.status]));
  if (filter.category_id !== undefined) conditions.push(eb('category_id', '=', filter.category_id));
  if (filter.available_only) conditions.push(sql<boolean>`(unlimited_flag = true OR quantity_available > 0)`);
  if (filter.delivery_braname) {
    conditions.push(sql<boolean>`delivery_points @> ${JSON.stringify([{ braname: filter.delivery_braname }])}::jsonb`);
  }
  return conditions;
}

@Injectable()
export class MarketplaceOfferRepositoryAdapter implements MarketplaceOfferDomainRepository {
  constructor(
    @Inject(MARKETPLACE_OFFER_STORE)
private readonly repo: TableStore<MarketplaceOfferEntity>,
    private readonly mapper: MarketplaceOfferMapper,
    // Счётчики оферты меняются сырым SQL (атомарный резерв), мимо подписчика
    // ленты изменений, — сигнал публикуем сами после записи.
    @Optional() @Inject(CHAIN_CHANGES_PORT) private readonly chainChanges: IChainChangesPort | null = null
  ) {}

  async findById(id: string): Promise<MarketplaceOfferDomainEntity | null> {
    const row = await this.repo.findOne({ id });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByIds(ids: string[]): Promise<MarketplaceOfferDomainEntity[]> {
    if (ids.length === 0) return [];
    const rows = await this.repo.find({ id: oneOf(ids) });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async list(
    filter: OfferListFilter,
    pagination: PaginationInputDTO
  ): Promise<PaginationResult<MarketplaceOfferDomainEntity>> {
    const query = this.repo.kysely.selectFrom('marketplace_offer').where((eb) => eb.and(offerConditions(eb, filter)));

    const column = MarketplaceOfferRepositoryAdapter.resolveSortColumn(pagination.sortBy);
    const direction = sortDirection(pagination.sortOrder, 'asc');
    const { page, limit } = pagination;
    let ordered = query.selectAll().orderBy(column, direction);
    if (column !== 'created_at') ordered = ordered.orderBy('created_at', 'desc');

    const rows = await ordered
      .offset((page - 1) * limit)
      .limit(limit)
      .execute();
    const total = await query.select((eb) => eb.fn.countAll<string>().as('count')).executeTakeFirstOrThrow();
    const totalCount = Number(total.count);
    return {
      items: this.repo.records(rows).map((r) => this.mapper.toDomain(r)),
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  }

  /** Колонка сортировки витрины: только из своего перечня, иначе — по дате создания. */
  private static resolveSortColumn(sortBy: string | undefined): 'price_per_unit' | 'product_name' | 'created_at' {
    if (sortBy === 'price') return 'price_per_unit';
    return sortColumn(['price_per_unit', 'product_name', 'created_at'] as const, sortBy, 'created_at');
  }

  async countByCategory(
    coopname: string,
    delivery_braname?: string | null
  ): Promise<Map<number, number>> {
    // Счётчики сужаются до пункта выдачи тем же условием, что и витрина
    // (см. list), иначе категория «есть» по кооперативу, но пуста на пункте.
    const rows = await this.repo.kysely
      .selectFrom('marketplace_offer')
      .select('category_id')
      .select((eb) => eb.fn.countAll<string>().as('cnt'))
      .where((eb) =>
        eb.and(offerConditions(eb, { coopname, status: MarketplaceOfferStatuses.ACTIVE, available_only: true, delivery_braname }))
      )
      .groupBy('category_id')
      .execute();

    const result = new Map<number, number>();
    for (const r of rows) {
      result.set(Number(r.category_id), Number(r.cnt));
    }
    return result;
  }

  async countRecentCreatedBy(supplier_account: string, sinceMs: number): Promise<number> {
    const since = new Date(Date.now() - sinceMs);
    return this.repo.count({ supplier_account, created_at: moreOrEqual(since) });
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
      sale_form: input.sale_form,
      packages: input.packages ?? [],
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
    const row = await this.repo.findOneOrFail({ id });
    return this.mapper.toDomain(row);
  }

  async applyBlockDelta(offer_id: string, qty: number, pkg?: OfferPackageDelta): Promise<OfferCountersDeltaResult> {
    return this.applyCounterDelta('block', offer_id, qty, pkg);
  }

  async applyUnblockDelta(offer_id: string, qty: number, pkg?: OfferPackageDelta): Promise<OfferCountersDeltaResult> {
    return this.applyCounterDelta('unblock', offer_id, qty, pkg);
  }

  async applyConsumeDelta(offer_id: string, qty: number, pkg?: OfferPackageDelta): Promise<OfferCountersDeltaResult> {
    return this.applyCounterDelta('consume', offer_id, qty, pkg);
  }

  async applyRollbackDelta(offer_id: string, qty: number, pkg?: OfferPackageDelta): Promise<OfferCountersDeltaResult> {
    // ADR-005: rollback без CAS — counter может уйти в отрицательное
    // значение при rollback Order'а, который уже перешёл в consumed.
    // Это ожидаемо при катастрофе fork-вне-Rollback-Horizon; fix через
    // manual reconciliation (FR12 ARCH-sync).
    return this.applyCounterDelta('rollback', offer_id, qty, pkg);
  }

  /**
   * Одна атомарная команда на все четыре движения. Счётчики предложения (в
   * базовых единицах) и счётчик заказанной упаковки (в упаковках, внутри
   * jsonb `packages`) меняются одним UPDATE, поэтому гонка параллельных
   * заказов их не разводит, а нехватка проверяется в WHERE по той упаковке,
   * что заказана: литров может хватать, а бутылок нужного объёма — нет.
   */
  private async applyCounterDelta(
    op: OfferCounterOp,
    offer_id: string,
    qty: number,
    pkg?: OfferPackageDelta
  ): Promise<OfferCountersDeltaResult> {
    const failure = op === 'block' ? 'insufficient_available' : 'insufficient_blocked';
    if (qty <= 0 || (pkg && pkg.count <= 0)) return { ok: false, reason: failure };

    const spec = OFFER_COUNTER_SQL[op];
    const params: unknown[] = [offer_id, qty];
    const sets = [spec.offer, 'updated_at = NOW()'];
    const where = ['o.id = $1', spec.where];
    if (pkg) {
      params.push(pkg.id, pkg.count);
      sets.push(`packages = (${packageRewriteSql(spec.pkg)})`);
      if (op === 'block') where.push(PACKAGE_AVAILABLE_GUARD_SQL);
    }
    const rows = await rawQuery(
      this.repo.kysely,
      `UPDATE marketplace_offer o SET ${sets.join(', ')} WHERE ${where.filter(Boolean).join(' AND ')} RETURNING *`,
      params
    );
    return this.interpretDelta(rows, offer_id, failure);
  }

  /** Исход правки счётчиков: правка без строки — нет предложения, оно не активно либо не хватило остатка. */
  private async interpretDelta(
    rows: unknown[],
    offer_id: string,
    failureReason: 'insufficient_available' | 'insufficient_blocked'
  ): Promise<OfferCountersDeltaResult> {
    const updatedRow = rows.length > 0 ? rows[0] : null;

    if (!updatedRow) {
      const existing = await this.repo.findOne({ id: offer_id });
      if (!existing) return { ok: false, reason: 'offer_not_found' };
      if (failureReason === 'insufficient_available' && existing.status !== MarketplaceOfferStatuses.ACTIVE) {
        return { ok: false, reason: 'offer_not_active' };
      }
      return { ok: false, reason: failureReason };
    }

    void this.chainChanges?.publishLocal('marketplace_offer', offer_id);

    // pg возвращает column-by-column как plain object; нормализуем через
    // повторный findOne для прохода mapper (timestamp coercion, типизация).
    const offer = await this.repo.findOneOrFail({ id: offer_id });
    return { ok: true, offer: this.mapper.toDomain(offer) };
  }
}
