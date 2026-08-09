import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  MarketplaceSupplierCreateInput,
  MarketplaceSupplierDomainRepository,
  MarketplaceSupplierPatchInput,
} from '../../domain/repositories/marketplace-supplier.repository';
import { MarketplaceSupplierDomainEntity } from '../../domain/entities/marketplace-supplier.entity';
import { MarketplaceSupplierEntity } from '../entities/marketplace-supplier.entity';
import { MarketplaceSupplierMapper } from '../mappers/marketplace-supplier.mapper';

@Injectable()
export class MarketplaceSupplierRepositoryAdapter
  implements MarketplaceSupplierDomainRepository
{
  constructor(
    @InjectRepository(MarketplaceSupplierEntity, 'marketplace')
    private readonly repo: Repository<MarketplaceSupplierEntity>,
    private readonly mapper: MarketplaceSupplierMapper
  ) {}

  async list(coopname: string): Promise<MarketplaceSupplierDomainEntity[]> {
    const rows = await this.repo.find({
      where: { coopname },
      order: { requested_at: 'ASC' },
    });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async findByMember(
    coopname: string,
    member_account: string
  ): Promise<MarketplaceSupplierDomainEntity | null> {
    const row = await this.repo.findOne({ where: { coopname, member_account } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async create(input: MarketplaceSupplierCreateInput): Promise<MarketplaceSupplierDomainEntity> {
    const row = this.repo.create({
      coopname: input.coopname,
      member_account: input.member_account,
      model: input.model,
      status: input.status,
      contract_number: input.contract_number,
      contract_date: input.contract_date,
      contract_document_url: null,
      requested_by: input.requested_by,
      reviewed_by: input.reviewed_by,
      reviewed_at: input.reviewed_by ? new Date() : null,
    });
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async patch(
    coopname: string,
    member_account: string,
    patch: MarketplaceSupplierPatchInput
  ): Promise<MarketplaceSupplierDomainEntity> {
    const row = await this.repo.findOne({ where: { coopname, member_account } });
    if (!row) {
      throw new NotFoundException(`Поставщик ${member_account} не найден в реестре.`);
    }
    if (patch.model !== undefined) row.model = patch.model;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.contract_number !== undefined) row.contract_number = patch.contract_number;
    if (patch.contract_date !== undefined) row.contract_date = patch.contract_date;
    if (patch.reviewed_by !== undefined) row.reviewed_by = patch.reviewed_by;
    if (patch.reviewed_at !== undefined) row.reviewed_at = patch.reviewed_at;
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async remove(coopname: string, member_account: string): Promise<void> {
    await this.repo.delete({ coopname, member_account });
  }
}
