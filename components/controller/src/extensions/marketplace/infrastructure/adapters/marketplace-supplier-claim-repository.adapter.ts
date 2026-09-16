import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { MarketplaceSupplierClaimDomainEntity } from '../../domain/entities/marketplace-supplier-claim.entity';
import {
  MarketplaceSupplierClaimStatuses,
  type MarketplaceSupplierClaimStatus,
} from '../../domain/entities/marketplace-supplier-claim.types';
import type {
  MarketplaceSupplierClaimAdmitPatch,
  MarketplaceSupplierClaimCreateInput,
  MarketplaceSupplierClaimDomainRepository,
} from '../../domain/repositories/marketplace-supplier-claim.repository';
import { MarketplaceSupplierClaimEntity } from '../entities/marketplace-supplier-claim.entity';
import { MarketplaceSupplierClaimMapper } from '../mappers/marketplace-supplier-claim.mapper';

@Injectable()
export class MarketplaceSupplierClaimRepositoryAdapter implements MarketplaceSupplierClaimDomainRepository {
  constructor(
    @InjectRepository(MarketplaceSupplierClaimEntity, 'marketplace')
    private readonly repo: Repository<MarketplaceSupplierClaimEntity>,
    private readonly mapper: MarketplaceSupplierClaimMapper
  ) {}

  async createIfNotExists(input: MarketplaceSupplierClaimCreateInput): Promise<MarketplaceSupplierClaimDomainEntity> {
    const existing = await this.repo.findOne({ where: { coopname: input.coopname, claim_hash: input.claim_hash } });
    if (existing) return this.mapper.toDomain(existing);
    const row = this.repo.create({
      ...input,
      status: MarketplaceSupplierClaimStatuses.PENDING,
      decided_at: null,
      decide_tx_hash: null,
    });
    try {
      const saved = await this.repo.save(row);
      return this.mapper.toDomain(saved);
    } catch (err: any) {
      // Гонка двух слушателей одного события: вторую запись отбил unique-индекс.
      if (String(err?.code) === '23505') {
        const again = await this.repo.findOne({ where: { coopname: input.coopname, claim_hash: input.claim_hash } });
        if (again) return this.mapper.toDomain(again);
      }
      throw err;
    }
  }

  async findById(id: string): Promise<MarketplaceSupplierClaimDomainEntity | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByClaimHash(coopname: string, claim_hash: string): Promise<MarketplaceSupplierClaimDomainEntity | null> {
    const row = await this.repo.findOne({ where: { coopname, claim_hash } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async listBySupplier(coopname: string, supplier_account: string): Promise<MarketplaceSupplierClaimDomainEntity[]> {
    const rows = await this.repo.find({ where: { coopname, supplier_account }, order: { issued_at: 'DESC' } });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async listAll(
    coopname: string,
    filter?: { supplier_account?: string; statuses?: MarketplaceSupplierClaimStatus[] }
  ): Promise<MarketplaceSupplierClaimDomainEntity[]> {
    const where: Record<string, unknown> = { coopname };
    if (filter?.supplier_account) where.supplier_account = filter.supplier_account;
    if (filter?.statuses?.length) where.status = In(filter.statuses);
    const rows = await this.repo.find({ where, order: { issued_at: 'DESC' } });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async admit(id: string, patch: MarketplaceSupplierClaimAdmitPatch): Promise<MarketplaceSupplierClaimDomainEntity | null> {
    const result = await this.repo
      .createQueryBuilder()
      .update(MarketplaceSupplierClaimEntity)
      .set({
        status: MarketplaceSupplierClaimStatuses.ADMITTED,
        decided_at: patch.decided_at,
        decide_tx_hash: patch.decide_tx_hash ?? null,
      })
      .where('id = :id AND status = :pending', { id, pending: MarketplaceSupplierClaimStatuses.PENDING })
      .execute();
    if (!result.affected) return null;
    return this.findById(id);
  }
}
