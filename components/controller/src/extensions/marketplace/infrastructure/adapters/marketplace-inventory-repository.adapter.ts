import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MarketplaceInventoryDomainEntity } from '../../domain/entities/marketplace-inventory.entity';
import {
  MarketplaceInventoryOnWarehouseStatuses,
  MarketplaceInventoryStatuses,
  type MarketplaceInventoryStatus,
} from '../../domain/entities/marketplace-inventory.types';
import type {
  MarketplaceInventoryCreateInput,
  MarketplaceInventoryDomainRepository,
  MarketplaceInventoryLabelPatch,
  MarketplaceInventoryListFilter,
} from '../../domain/repositories/marketplace-inventory.repository';
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
      received_at: input.received_at,
      received_by_operator_account: input.received_by_operator_account,
      labeled_at: input.labeled_at ?? null,
      labeled_by_operator_account: input.labeled_by_operator_account ?? null,
      expiry_date: input.expiry_date ?? null,
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
      .andWhere('inv.status IN (:...statuses)', {
        statuses: MarketplaceInventoryOnWarehouseStatuses,
      })
      .groupBy('inv.order_id')
      .getRawMany<{ order_id: string; total: string }>();
    // SUM по int-колонке PostgreSQL приходит строкой — приводим явно.
    return new Map(rows.map((r) => [r.order_id, Number(r.total)]));
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
    const rows = await this.repo.find({ where, order: { received_at: 'DESC', created_at: 'DESC' } });
    return rows.map((r) => this.mapper.toDomain(r));
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
        status: In([
          MarketplaceInventoryStatuses.RECEIVED,
          MarketplaceInventoryStatuses.LABELED,
        ]),
      },
      { status: MarketplaceInventoryStatuses.ISSUED }
    );
    return res.affected ?? 0;
  }

  async assignShelf(id: string, shelf: string | null): Promise<MarketplaceInventoryDomainEntity> {
    await this.repo.update({ id }, { shelf });
    const row = await this.repo.findOneOrFail({ where: { id } });
    return this.mapper.toDomain(row);
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
    shelf: string | null
  ): Promise<MarketplaceInventoryDomainEntity> {
    await this.repo.update({ id }, { quantity_per_label, shelf });
    const row = await this.repo.findOneOrFail({ where: { id } });
    return this.mapper.toDomain(row);
  }

  async deleteById(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
