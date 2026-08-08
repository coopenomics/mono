import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketplaceTtnDocumentDomainEntity } from '../../domain/entities/marketplace-ttn-document.entity';
import type {
  MarketplaceTtnDocumentCreateInput,
  MarketplaceTtnDocumentDomainRepository,
} from '../../domain/repositories/marketplace-ttn-document.repository';
import { MarketplaceTtnDocumentEntity } from '../entities/marketplace-ttn-document.entity';
import { MarketplaceTtnDocumentMapper } from '../mappers/marketplace-ttn-document.mapper';

@Injectable()
export class MarketplaceTtnDocumentRepositoryAdapter
  implements MarketplaceTtnDocumentDomainRepository
{
  constructor(
    @InjectRepository(MarketplaceTtnDocumentEntity, 'marketplace')
    private readonly repo: Repository<MarketplaceTtnDocumentEntity>,
    private readonly mapper: MarketplaceTtnDocumentMapper
  ) {}

  async create(
    input: MarketplaceTtnDocumentCreateInput
  ): Promise<MarketplaceTtnDocumentDomainEntity> {
    const row = this.repo.create({
      coopname: input.coopname,
      shipment_id: input.shipment_id,
      ttn_number: input.ttn_number,
      registry_id: input.registry_id,
      document_hash: input.document_hash,
      content_html: input.content_html,
      meta: input.meta,
      supplier_account: input.supplier_account,
      accept_braname: input.accept_braname,
      total_amount: input.total_amount,
      currency: input.currency,
      ttn_data: input.ttn_data,
    });
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async findById(id: string): Promise<MarketplaceTtnDocumentDomainEntity | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByShipmentId(
    coopname: string,
    shipment_id: string
  ): Promise<MarketplaceTtnDocumentDomainEntity | null> {
    const row = await this.repo.findOne({ where: { coopname, shipment_id } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByTtnNumber(
    coopname: string,
    ttn_number: string
  ): Promise<MarketplaceTtnDocumentDomainEntity | null> {
    const row = await this.repo.findOne({ where: { coopname, ttn_number } });
    return row ? this.mapper.toDomain(row) : null;
  }
}
