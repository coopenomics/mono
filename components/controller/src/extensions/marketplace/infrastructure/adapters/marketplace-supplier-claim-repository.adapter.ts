import { TableStore, oneOf } from '@coopenomics/extension-kit';
import { MARKETPLACE_SUPPLIER_CLAIM_STORE } from '../../infrastructure/database/marketplace-stores';
import { Inject, Injectable } from '@nestjs/common';
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
    @Inject(MARKETPLACE_SUPPLIER_CLAIM_STORE)
private readonly repo: TableStore<MarketplaceSupplierClaimEntity>,
    private readonly mapper: MarketplaceSupplierClaimMapper
  ) {}

  async createIfNotExists(input: MarketplaceSupplierClaimCreateInput): Promise<MarketplaceSupplierClaimDomainEntity> {
    const existing = await this.repo.findOne({ coopname: input.coopname, claim_hash: input.claim_hash });
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
        const again = await this.repo.findOne({ coopname: input.coopname, claim_hash: input.claim_hash });
        if (again) return this.mapper.toDomain(again);
      }
      throw err;
    }
  }

  async findById(id: string): Promise<MarketplaceSupplierClaimDomainEntity | null> {
    const row = await this.repo.findOne({ id });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByClaimHash(coopname: string, claim_hash: string): Promise<MarketplaceSupplierClaimDomainEntity | null> {
    const row = await this.repo.findOne({ coopname, claim_hash });
    return row ? this.mapper.toDomain(row) : null;
  }

  async listBySupplier(coopname: string, supplier_account: string): Promise<MarketplaceSupplierClaimDomainEntity[]> {
    const rows = await this.repo.find({ coopname, supplier_account }, { order: { issued_at: 'DESC' } });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async listAll(
    coopname: string,
    filter?: { supplier_account?: string; statuses?: MarketplaceSupplierClaimStatus[] }
  ): Promise<MarketplaceSupplierClaimDomainEntity[]> {
    const where: Record<string, unknown> = { coopname };
    if (filter?.supplier_account) where.supplier_account = filter.supplier_account;
    if (filter?.statuses?.length) where.status = oneOf(filter.statuses);
    const rows = await this.repo.find(where, { order: { issued_at: 'DESC' } });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async admit(id: string, patch: MarketplaceSupplierClaimAdmitPatch): Promise<MarketplaceSupplierClaimDomainEntity | null> {
    // Признаётся только ожидающая претензия: условие по статусу в самой правке.
    const admitted = await this.repo.update(
      { id, status: MarketplaceSupplierClaimStatuses.PENDING },
      {
        status: MarketplaceSupplierClaimStatuses.ADMITTED,
        decided_at: patch.decided_at,
        decide_tx_hash: patch.decide_tx_hash ?? null,
      }
    );
    if (!admitted) return null;
    return this.findById(id);
  }
}
