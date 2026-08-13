import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository, type EntityManager } from 'typeorm';
import { MarketplaceInventoryDomainEntity } from '../../domain/entities/marketplace-inventory.entity';
import type {
  MarketplaceInventoryLocation,
  MarketplaceInventoryPlacement,
} from '../../domain/entities/marketplace-inventory.types';
import {
  MarketplaceInventoryOnWarehouseStatuses,
  MarketplaceInventoryOwnerships,
  MarketplaceInventoryStatuses,
  type MarketplaceInventoryStatus,
} from '../../domain/entities/marketplace-inventory.types';
import type {
  MarketplaceInventoryCreateInput,
  MarketplaceInventoryDomainRepository,
  MarketplaceInventoryLabelPatch,
  MarketplaceInventoryListFilter,
  MarketplaceWriteoffCandidate,
} from '../../domain/repositories/marketplace-inventory.repository';
import { MarketplaceUnitsOfMeasure } from '../../domain/entities/marketplace-offer.types';
import { MarketplaceInventoryEntity } from '../entities/marketplace-inventory.entity';
import { MarketplaceInventoryMapper } from '../mappers/marketplace-inventory.mapper';

@Injectable()
export class MarketplaceInventoryRepositoryAdapter implements MarketplaceInventoryDomainRepository {
  constructor(
    @InjectRepository(MarketplaceInventoryEntity, 'marketplace')
    private readonly repo: Repository<MarketplaceInventoryEntity>,
    private readonly mapper: MarketplaceInventoryMapper
  ) {}

  async create(input: MarketplaceInventoryCreateInput): Promise<MarketplaceInventoryDomainEntity> {
    const row = this.repo.create({
      coopname: input.coopname,
      barcode_value: input.barcode_value ?? null,
      barcode_format: input.barcode_format ?? null,
      order_id: input.order_id,
      shipment_id: input.shipment_id,
      braname: input.braname,
      status: input.status,
      product_name_snapshot: input.product_name_snapshot,
      quantity_per_label: input.quantity_per_label,
      orderer_account_snapshot: input.orderer_account_snapshot,
      shelf: input.shelf ?? null,
      cell_id: input.cell_id ?? null,
      container_id: input.container_id ?? null,
      received_at: input.received_at,
      received_by_operator_account: input.received_by_operator_account,
      labeled_at: input.labeled_at ?? null,
      labeled_by_operator_account: input.labeled_by_operator_account ?? null,
      expiry_date: input.expiry_date ?? null,
      ownership: input.ownership ?? MarketplaceInventoryOwnerships.ORDER,
      arrival_price: input.arrival_price ?? null,
      package_size: input.package_size ?? 0,
      unit_of_measure: input.unit_of_measure ?? MarketplaceUnitsOfMeasure.PIECE,
    });
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async findById(id: string): Promise<MarketplaceInventoryDomainEntity | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByBarcode(
    coopname: string,
    barcode_value: string
  ): Promise<MarketplaceInventoryDomainEntity | null> {
    const row = await this.repo.findOne({ where: { coopname, barcode_value } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async countByOrder(coopname: string, order_id: string): Promise<number> {
    return this.repo.count({ where: { coopname, order_id } });
  }

  async sumOnWarehouseByOrders(
    coopname: string,
    order_ids: string[]
  ): Promise<Map<string, number>> {
    if (order_ids.length === 0) return new Map();
    const rows = await this.repo
      .createQueryBuilder('inv')
      .select('inv.order_id', 'order_id')
      .addSelect('SUM(inv.quantity_per_label)', 'total')
      .where('inv.coopname = :coopname', { coopname })
      .andWhere('inv.order_id IN (:...order_ids)', { order_ids })
      // Только адресные позиции: COOP-остаток хранит order_id лишь как
      // провенанс и «принятым по заказу» не считается (requirement 76).
      .andWhere('inv.ownership = :ownership', { ownership: MarketplaceInventoryOwnerships.ORDER })
      .andWhere('inv.status IN (:...statuses)', {
        statuses: MarketplaceInventoryOnWarehouseStatuses,
      })
      .groupBy('inv.order_id')
      .getRawMany<{ order_id: string; total: string }>();
    // SUM по int-колонке PostgreSQL приходит строкой — приводим явно.
    return new Map(rows.map((r) => [r.order_id, Number(r.total)]));
  }

  async locationsOnWarehouseByOrders(
    coopname: string,
    order_ids: string[]
  ): Promise<Map<string, MarketplaceInventoryLocation[]>> {
    if (order_ids.length === 0) return new Map();
    // Ячейка берётся у бокса, если позиция лежит в таре, и своя — если
    // имущество положено в ячейку напрямую (негабарит).
    const rows = await this.repo
      .createQueryBuilder('inv')
      .select('inv.order_id', 'order_id')
      .addSelect('box.code', 'container_code')
      .addSelect('cell.code', 'cell_code')
      .leftJoin('marketplace_container', 'box', 'box.id = inv.container_id')
      .leftJoin(
        'marketplace_storage_cell',
        'cell',
        'cell.id = COALESCE(box.cell_id, inv.cell_id)'
      )
      .where('inv.coopname = :coopname', { coopname })
      .andWhere('inv.order_id IN (:...order_ids)', { order_ids })
      .andWhere('inv.ownership = :ownership', { ownership: MarketplaceInventoryOwnerships.ORDER })
      .andWhere('inv.status IN (:...statuses)', {
        statuses: MarketplaceInventoryOnWarehouseStatuses,
      })
      .andWhere('(inv.container_id IS NOT NULL OR inv.cell_id IS NOT NULL)')
      .distinct(true)
      .getRawMany<{ order_id: string; container_code: string | null; cell_code: string | null }>();

    const out = new Map<string, MarketplaceInventoryLocation[]>();
    for (const r of rows) {
      const arr = out.get(r.order_id) ?? [];
      const already = arr.some(
        (l) => l.container_code === r.container_code && l.cell_code === r.cell_code
      );
      if (!already) arr.push({ container_code: r.container_code, cell_code: r.cell_code });
      out.set(r.order_id, arr);
    }
    return out;
  }

  async arrivalPriceOnWarehouseByOrders(
    coopname: string,
    order_ids: string[]
  ): Promise<Map<string, string>> {
    if (order_ids.length === 0) return new Map();
    // Позиции одного заказа приходят одной приёмкой и по одной цене, но
    // берём минимальную: если приёмок было несколько, платить пайщику по
    // худшей для кооператива цене честнее, чем по лучшей.
    const rows = await this.repo
      .createQueryBuilder('inv')
      .select('inv.order_id', 'order_id')
      .addSelect('MIN(inv.arrival_price)', 'arrival_price')
      .where('inv.coopname = :coopname', { coopname })
      .andWhere('inv.order_id IN (:...order_ids)', { order_ids })
      .andWhere('inv.ownership = :ownership', { ownership: MarketplaceInventoryOwnerships.ORDER })
      .andWhere('inv.status IN (:...statuses)', {
        statuses: MarketplaceInventoryOnWarehouseStatuses,
      })
      .andWhere('inv.arrival_price IS NOT NULL')
      .groupBy('inv.order_id')
      .getRawMany<{ order_id: string; arrival_price: string }>();

    return new Map(rows.map((r) => [r.order_id, String(r.arrival_price)]));
  }

  async list(filter: MarketplaceInventoryListFilter): Promise<MarketplaceInventoryDomainEntity[]> {
    const where: Record<string, unknown> = { coopname: filter.coopname };
    if (filter.order_id) where.order_id = filter.order_id;
    if (filter.shipment_id) where.shipment_id = filter.shipment_id;
    if (filter.braname) {
      where.braname = Array.isArray(filter.braname) ? In(filter.braname) : filter.braname;
    }
    if (filter.status) {
      where.status = Array.isArray(filter.status) ? In(filter.status) : filter.status;
    }
    if (filter.ownership) where.ownership = filter.ownership;
    if (filter.reserved_order_id) where.reserved_order_id = filter.reserved_order_id;
    if (filter.free_only) where.reserved_order_id = IsNull();
    if (filter.published !== undefined) {
      where.published_offer_id = filter.published ? Not(IsNull()) : IsNull();
    }
    if (filter.published_offer_id) where.published_offer_id = filter.published_offer_id;
    const rows = await this.repo.find({ where, order: { received_at: 'DESC', created_at: 'DESC' } });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async findWriteoffCandidates(
    coopname: string,
    cutoff: Date
  ): Promise<MarketplaceWriteoffCandidate[]> {
    // Все позиции на складе — председатель собирает корзину вручную и может
    // списать как просроченное, так и ещё годное (порча/невозврат). Просрочку
    // подсвечиваем флагом is_expired, не отсекаем фильтром.
    const rows = await this.repo.find({
      where: {
        coopname,
        status: In([...MarketplaceInventoryOnWarehouseStatuses]),
      },
      order: { expiry_date: 'ASC', created_at: 'ASC' },
      take: 500,
    });
    const cutoffMs = cutoff.getTime();
    return rows
      .map((r) => ({
        inventory_id: r.id,
        braname: r.braname,
        asset_title: r.product_name_snapshot,
        quantity: r.quantity_per_label,
        arrival_price: r.arrival_price,
        package_size: r.package_size,
        unit_of_measure: r.unit_of_measure,
        expiry_date: r.expiry_date,
        is_expired: r.expiry_date !== null && r.expiry_date.getTime() <= cutoffMs,
      }))
      // Просроченное — наверх (первоочередные кандидаты), затем остальное.
      .sort((a, b) => Number(b.is_expired) - Number(a.is_expired));
  }

  async applyStatusTransition(
    id: string,
    newStatus: MarketplaceInventoryStatus
  ): Promise<MarketplaceInventoryDomainEntity> {
    await this.repo.update({ id }, { status: newStatus });
    const row = await this.repo.findOneOrFail({ where: { id } });
    return this.mapper.toDomain(row);
  }

  async markIssuedByOrder(coopname: string, order_id: string): Promise<number> {
    const res = await this.repo.update(
      {
        coopname,
        order_id,
        ownership: MarketplaceInventoryOwnerships.ORDER,
        status: In([
          MarketplaceInventoryStatuses.RECEIVED,
          MarketplaceInventoryStatuses.LABELED,
        ]),
      },
      { status: MarketplaceInventoryStatuses.ISSUED }
    );
    return res.affected ?? 0;
  }

  async assignPlacement(
    id: string,
    placement: MarketplaceInventoryPlacement
  ): Promise<MarketplaceInventoryDomainEntity> {
    await this.repo.update(
      { id },
      { cell_id: placement.cell_id, container_id: placement.container_id }
    );
    const row = await this.repo.findOneOrFail({ where: { id } });
    return this.mapper.toDomain(row);
  }

  async countOnWarehouseByCell(coopname: string, cell_id: string): Promise<number> {
    return this.repo.count({
      where: {
        coopname,
        cell_id,
        status: In([...MarketplaceInventoryOnWarehouseStatuses]),
      },
    });
  }

  async countOnWarehouseByContainer(coopname: string, container_id: string): Promise<number> {
    return this.repo.count({
      where: {
        coopname,
        container_id,
        status: In([...MarketplaceInventoryOnWarehouseStatuses]),
      },
    });
  }

  async applyLabel(
    id: string,
    patch: MarketplaceInventoryLabelPatch
  ): Promise<MarketplaceInventoryDomainEntity> {
    await this.repo.update(
      { id },
      {
        barcode_value: patch.barcode_value,
        barcode_format: patch.barcode_format,
        labeled_at: patch.labeled_at,
        labeled_by_operator_account: patch.labeled_by_operator_account,
        status: MarketplaceInventoryStatuses.LABELED,
      }
    );
    const row = await this.repo.findOneOrFail({ where: { id } });
    return this.mapper.toDomain(row);
  }

  async clearLabel(id: string): Promise<MarketplaceInventoryDomainEntity> {
    await this.repo.update(
      { id },
      {
        barcode_value: null,
        barcode_format: null,
        labeled_at: null,
        labeled_by_operator_account: null,
        status: MarketplaceInventoryStatuses.RECEIVED,
      }
    );
    const row = await this.repo.findOneOrFail({ where: { id } });
    return this.mapper.toDomain(row);
  }

  async resize(
    id: string,
    quantity_per_label: number,
    placement: MarketplaceInventoryPlacement
  ): Promise<MarketplaceInventoryDomainEntity> {
    await this.repo.update(
      { id },
      {
        quantity_per_label,
        cell_id: placement.cell_id,
        container_id: placement.container_id,
      }
    );
    const row = await this.repo.findOneOrFail({ where: { id } });
    return this.mapper.toDomain(row);
  }

  async deleteById(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  // ── requirement 76: обезличенный остаток склада КУ ──────────────────

  async detachRemainderToStock(
    coopname: string,
    order_id: string,
    issued_quantity: number,
    arrival_price: string | null
  ): Promise<number> {
    return this.repo.manager.transaction(async (em) => {
      const rows = await em.getRepository(MarketplaceInventoryEntity).find({
        where: {
          coopname,
          order_id,
          ownership: MarketplaceInventoryOwnerships.ORDER,
          status: In([...MarketplaceInventoryOnWarehouseStatuses]),
        },
        // Выдаём в первую очередь то, что портится раньше; остаток — более свежее.
        order: { expiry_date: 'ASC', created_at: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      let remainingToIssue = issued_quantity;
      let detached = 0;
      for (const row of rows) {
        if (remainingToIssue >= row.quantity_per_label) {
          remainingToIssue -= row.quantity_per_label;
          await em.update(MarketplaceInventoryEntity, { id: row.id }, {
            status: MarketplaceInventoryStatuses.ISSUED,
          });
        } else if (remainingToIssue > 0) {
          // Пограничная позиция: выданная часть остаётся адресной (ISSUED),
          // невостребованная — отдельной записью уходит в остаток кооператива.
          const stockQty = row.quantity_per_label - remainingToIssue;
          await em.update(MarketplaceInventoryEntity, { id: row.id }, {
            status: MarketplaceInventoryStatuses.ISSUED,
            quantity_per_label: remainingToIssue,
          });
          await em.insert(MarketplaceInventoryEntity, this.buildStockSplitRow(row, stockQty, arrival_price));
          detached += stockQty;
          remainingToIssue = 0;
        } else {
          await em.update(MarketplaceInventoryEntity, { id: row.id }, {
            ownership: MarketplaceInventoryOwnerships.COOP,
            arrival_price: row.arrival_price ?? arrival_price,
          });
          detached += row.quantity_per_label;
        }
      }
      return detached;
    });
  }

  async reserveStock(
    coopname: string,
    published_offer_id: string,
    quantity: number,
    order_id: string
  ): Promise<void> {
    await this.repo.manager.transaction(async (em) => {
      const rows = await em.getRepository(MarketplaceInventoryEntity).find({
        where: {
          coopname,
          published_offer_id,
          ownership: MarketplaceInventoryOwnerships.COOP,
          status: In([...MarketplaceInventoryOnWarehouseStatuses]),
          reserved_order_id: IsNull(),
        },
        // FIFO по сроку годности: первым уходит то, что портится раньше.
        order: { expiry_date: 'ASC', created_at: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      let needed = quantity;
      for (const row of rows) {
        if (needed <= 0) break;
        if (row.quantity_per_label <= needed) {
          await em.update(MarketplaceInventoryEntity, { id: row.id }, { reserved_order_id: order_id });
          needed -= row.quantity_per_label;
        } else {
          // Пограничная позиция: режем — зарезервированная часть отдельной записью.
          await em.update(MarketplaceInventoryEntity, { id: row.id }, {
            quantity_per_label: row.quantity_per_label - needed,
          });
          await em.insert(MarketplaceInventoryEntity, {
            ...this.buildStockSplitRow(row, needed, row.arrival_price),
            published_offer_id: row.published_offer_id,
            reserved_order_id: order_id,
          });
          needed = 0;
        }
      }
      if (needed > 0) {
        throw new ConflictException(
          `Свободного остатка недостаточно: не хватает ${needed} ед. для резерва под заказ.`
        );
      }
    });
  }

  async releaseReservation(coopname: string, order_id: string): Promise<number> {
    const res = await this.repo.update(
      {
        coopname,
        reserved_order_id: order_id,
        status: In([...MarketplaceInventoryOnWarehouseStatuses]),
      },
      { reserved_order_id: null }
    );
    return res.affected ?? 0;
  }

  async sumReservedByOrders(coopname: string, order_ids: string[]): Promise<Map<string, number>> {
    if (order_ids.length === 0) return new Map();
    const rows = await this.repo
      .createQueryBuilder('inv')
      .select('inv.reserved_order_id', 'order_id')
      .addSelect('SUM(inv.quantity_per_label)', 'total')
      .where('inv.coopname = :coopname', { coopname })
      .andWhere('inv.reserved_order_id IN (:...order_ids)', { order_ids })
      .andWhere('inv.status IN (:...statuses)', {
        statuses: MarketplaceInventoryOnWarehouseStatuses,
      })
      .groupBy('inv.reserved_order_id')
      .getRawMany<{ order_id: string; total: string }>();
    return new Map(rows.map((r) => [r.order_id, Number(r.total)]));
  }

  async finalizeReservedIssue(
    coopname: string,
    order_id: string,
    issued_quantity: number,
    fallback_arrival_price: string
  ): Promise<{ released: number; issued_arrival_cost: string }> {
    const fallbackPrice = Number.parseFloat(fallback_arrival_price) || 0;
    return this.repo.manager.transaction(async (em) => {
      const rows = await em.getRepository(MarketplaceInventoryEntity).find({
        where: {
          coopname,
          reserved_order_id: order_id,
          status: In([...MarketplaceInventoryOnWarehouseStatuses]),
        },
        order: { expiry_date: 'ASC', created_at: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      let remainingToIssue = issued_quantity;
      let released = 0;
      // Стоимость выданного по ценам прибытия — основание для списания
      // уценки (o.mkt.loss): цены прибытия у позиций одного заказа могут
      // отличаться (FIFO-резерв).
      let issuedArrivalCost = 0;
      const arrivalOf = (row: MarketplaceInventoryEntity): number =>
        row.arrival_price !== null ? Number.parseFloat(row.arrival_price) : fallbackPrice;
      for (const row of rows) {
        if (remainingToIssue >= row.quantity_per_label) {
          remainingToIssue -= row.quantity_per_label;
          issuedArrivalCost += arrivalOf(row) * row.quantity_per_label;
          await em.update(MarketplaceInventoryEntity, { id: row.id }, {
            status: MarketplaceInventoryStatuses.ISSUED,
          });
        } else if (remainingToIssue > 0) {
          const releaseQty = row.quantity_per_label - remainingToIssue;
          issuedArrivalCost += arrivalOf(row) * remainingToIssue;
          await em.update(MarketplaceInventoryEntity, { id: row.id }, {
            status: MarketplaceInventoryStatuses.ISSUED,
            quantity_per_label: remainingToIssue,
          });
          // Невыданная часть возвращается в свободный опубликованный остаток.
          await em.insert(MarketplaceInventoryEntity, {
            ...this.buildStockSplitRow(row, releaseQty, row.arrival_price),
            published_offer_id: row.published_offer_id,
          });
          released += releaseQty;
          remainingToIssue = 0;
        } else {
          await em.update(MarketplaceInventoryEntity, { id: row.id }, { reserved_order_id: null });
          released += row.quantity_per_label;
        }
      }
      return { released, issued_arrival_cost: issuedArrivalCost.toFixed(4) };
    });
  }

  async setPublication(
    coopname: string,
    inventory_ids: string[],
    published_offer_id: string | null
  ): Promise<number> {
    if (inventory_ids.length === 0) return 0;
    const where: Parameters<Repository<MarketplaceInventoryEntity>['update']>[0] = {
      coopname,
      id: In(inventory_ids),
      ownership: MarketplaceInventoryOwnerships.COOP,
      status: In([...MarketplaceInventoryOnWarehouseStatuses]),
    };
    // Снять с публикации можно только свободную позицию: зарезервированная
    // уже обещана заказу из остатка.
    if (published_offer_id === null) {
      (where as Record<string, unknown>).reserved_order_id = IsNull();
    }
    const res = await this.repo.update(where, { published_offer_id });
    return res.affected ?? 0;
  }

  async sumFreePublishedByOffer(coopname: string, published_offer_id: string): Promise<number> {
    const row = await this.repo
      .createQueryBuilder('inv')
      .select('COALESCE(SUM(inv.quantity_per_label), 0)', 'total')
      .where('inv.coopname = :coopname', { coopname })
      .andWhere('inv.published_offer_id = :published_offer_id', { published_offer_id })
      .andWhere('inv.ownership = :ownership', { ownership: MarketplaceInventoryOwnerships.COOP })
      .andWhere('inv.reserved_order_id IS NULL')
      .andWhere('inv.status IN (:...statuses)', {
        statuses: MarketplaceInventoryOnWarehouseStatuses,
      })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  /**
   * Заготовка новой записи остатка при split'е пограничной позиции: копия
   * исходной без штрих-кода (уникален) и маркировки, со статусом RECEIVED,
   * ownership=COOP и провенансом исходного заказа.
   */
  private buildStockSplitRow(
    row: MarketplaceInventoryEntity,
    quantity: number,
    arrival_price: string | null
  ): Omit<MarketplaceInventoryEntity, 'id' | 'created_at' | 'updated_at'> {
    return {
      coopname: row.coopname,
      barcode_value: null,
      barcode_format: null,
      order_id: row.order_id,
      shipment_id: row.shipment_id,
      braname: row.braname,
      status: MarketplaceInventoryStatuses.RECEIVED,
      product_name_snapshot: row.product_name_snapshot,
      quantity_per_label: quantity,
      orderer_account_snapshot: row.orderer_account_snapshot,
      shelf: row.shelf,
      // Отколотый остаток остаётся там же, где лежала исходная позиция.
      cell_id: row.cell_id,
      container_id: row.container_id,
      received_at: row.received_at,
      received_by_operator_account: row.received_by_operator_account,
      labeled_at: null,
      labeled_by_operator_account: null,
      expiry_date: row.expiry_date,
      ownership: MarketplaceInventoryOwnerships.COOP,
      arrival_price: row.arrival_price ?? arrival_price,
      // Фасовка едет с отколотой частью: цена позиции — за единицу отпуска,
      // без размера упаковки её не с чем перемножать.
      package_size: row.package_size,
      unit_of_measure: row.unit_of_measure,
      published_offer_id: null,
      reserved_order_id: null,
    };
  }
}
