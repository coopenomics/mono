import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MarketplaceInventoryDomainEntity } from '../../domain/entities/marketplace-inventory.entity';
import type { MarketplaceInventoryStatus } from '../../domain/entities/marketplace-inventory.types';
import type {
  MarketplaceInventoryCreateInput,
  MarketplaceInventoryDomainRepository,
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
      barcode_value: input.barcode_value,
      barcode_format: input.barcode_format,
      order_id: input.order_id,
      shipment_id: input.shipment_id,
      braname: input.braname,
      status: input.status,
      product_name_snapshot: input.product_name_snapshot,
      quantity_per_label: input.quantity_per_label,
      orderer_account_snapshot: input.orderer_account_snapshot,
      labeled_at: input.labeled_at,
      labeled_by_operator_account: input.labeled_by_operator_account,
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

  async list(filter: MarketplaceInventoryListFilter): Promise<MarketplaceInventoryDomainEntity[]> {
    const where: Record<string, unknown> = { coopname: filter.coopname };
    if (filter.order_id) where.order_id = filter.order_id;
    if (filter.shipment_id) where.shipment_id = filter.shipment_id;
    if (filter.braname) where.braname = filter.braname;
    if (filter.status) {
      where.status = Array.isArray(filter.status) ? In(filter.status) : filter.status;
    }
    const rows = await this.repo.find({ where, order: { labeled_at: 'DESC' } });
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
}
