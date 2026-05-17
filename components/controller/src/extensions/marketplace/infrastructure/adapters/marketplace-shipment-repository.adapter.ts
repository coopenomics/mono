import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MarketplaceShipmentDomainEntity } from '../../domain/entities/marketplace-shipment.entity';
import type { MarketplaceShipmentStatus } from '../../domain/entities/marketplace-shipment.types';
import type {
  MarketplaceShipmentCreateInput,
  MarketplaceShipmentDomainRepository,
  MarketplaceShipmentListFilter,
} from '../../domain/repositories/marketplace-shipment.repository';
import { MarketplaceShipmentEntity } from '../entities/marketplace-shipment.entity';
import { MarketplaceShipmentMapper } from '../mappers/marketplace-shipment.mapper';

@Injectable()
export class MarketplaceShipmentRepositoryAdapter implements MarketplaceShipmentDomainRepository {
  constructor(
    @InjectRepository(MarketplaceShipmentEntity, 'marketplace')
    private readonly repo: Repository<MarketplaceShipmentEntity>,
    private readonly mapper: MarketplaceShipmentMapper
  ) {}

  async create(input: MarketplaceShipmentCreateInput): Promise<MarketplaceShipmentDomainEntity> {
    const row = this.repo.create({
      coopname: input.coopname,
      cycle_id: input.cycle_id,
      offerer_account: input.offerer_account,
      braname: input.braname,
      delivery_variant: input.delivery_variant,
      total_amount: input.total_amount,
      ttn_number: input.ttn_number,
      ttn_data: input.ttn_data,
      ttn_document_id: input.ttn_document_id,
      status: input.status,
    });
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async findById(id: string): Promise<MarketplaceShipmentDomainEntity | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByCycleAndKU(
    coopname: string,
    cycle_id: string,
    braname: string
  ): Promise<MarketplaceShipmentDomainEntity | null> {
    const row = await this.repo.findOne({ where: { coopname, cycle_id, braname } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByCycleId(
    coopname: string,
    cycle_id: string
  ): Promise<MarketplaceShipmentDomainEntity[]> {
    const rows = await this.repo.find({ where: { coopname, cycle_id } });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async findByTTNNumber(
    coopname: string,
    ttn_number: string
  ): Promise<MarketplaceShipmentDomainEntity | null> {
    const row = await this.repo.findOne({ where: { coopname, ttn_number } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async list(filter: MarketplaceShipmentListFilter): Promise<MarketplaceShipmentDomainEntity[]> {
    const where: Record<string, unknown> = { coopname: filter.coopname };
    if (filter.cycle_id) where.cycle_id = filter.cycle_id;
    if (filter.offerer_account) where.offerer_account = filter.offerer_account;
    if (filter.braname) where.braname = filter.braname;
    if (filter.status) {
      where.status = Array.isArray(filter.status) ? In(filter.status) : filter.status;
    }
    const rows = await this.repo.find({ where, order: { created_at: 'DESC' } });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async applyStatusTransition(
    id: string,
    newStatus: MarketplaceShipmentStatus
  ): Promise<MarketplaceShipmentDomainEntity> {
    await this.repo.update({ id }, { status: newStatus });
    const row = await this.repo.findOneOrFail({ where: { id } });
    return this.mapper.toDomain(row);
  }

  async applyTtnDocumentId(
    shipment_id: string,
    ttn_document_id: string
  ): Promise<MarketplaceShipmentDomainEntity> {
    await this.repo.update({ id: shipment_id }, { ttn_document_id });
    const row = await this.repo.findOneOrFail({ where: { id: shipment_id } });
    return this.mapper.toDomain(row);
  }
}
