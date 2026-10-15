import { TableStore } from '@coopenomics/extension-kit';
import { MARKETPLACE_TTN_DOCUMENT_STORE } from '../../infrastructure/database/marketplace-stores';
import { Inject, Injectable } from '@nestjs/common';
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
    @Inject(MARKETPLACE_TTN_DOCUMENT_STORE)
private readonly repo: TableStore<MarketplaceTtnDocumentEntity>,
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
    const row = await this.repo.findOne({ id });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByShipmentId(
    coopname: string,
    shipment_id: string
  ): Promise<MarketplaceTtnDocumentDomainEntity | null> {
    const row = await this.repo.findOne({ coopname, shipment_id });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByTtnNumber(
    coopname: string,
    ttn_number: string
  ): Promise<MarketplaceTtnDocumentDomainEntity | null> {
    const row = await this.repo.findOne({ coopname, ttn_number });
    return row ? this.mapper.toDomain(row) : null;
  }
}
