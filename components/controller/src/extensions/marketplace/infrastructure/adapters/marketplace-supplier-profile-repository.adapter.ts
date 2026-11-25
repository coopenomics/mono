import { TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { MarketplaceSupplierProfileDomainEntity } from '../../domain/entities/marketplace-supplier-profile.entity';
import type {
  MarketplaceSupplierProfileDomainRepository,
  SupplierProfilePatch,
} from '../../domain/repositories/marketplace-supplier-profile.repository';
import { MARKETPLACE_SUPPLIER_PROFILE_STORE } from '../database/marketplace-stores';
import { MarketplaceSupplierProfileEntity } from '../entities/marketplace-supplier-profile.entity';

@Injectable()
export class MarketplaceSupplierProfileRepositoryAdapter implements MarketplaceSupplierProfileDomainRepository {
  constructor(
    @Inject(MARKETPLACE_SUPPLIER_PROFILE_STORE)
    private readonly repo: TableStore<MarketplaceSupplierProfileEntity>
  ) {}

  async find(coopname: string, supplier_account: string): Promise<MarketplaceSupplierProfileDomainEntity | null> {
    const row = await this.repo.findOne({ coopname, supplier_account });
    return row ? toDomain(row) : null;
  }

  async save(
    coopname: string,
    supplier_account: string,
    patch: SupplierProfilePatch
  ): Promise<MarketplaceSupplierProfileDomainEntity> {
    const existing = await this.repo.findOne({ coopname, supplier_account });
    if (existing) {
      await this.repo.update({ id: existing.id }, patch);
      return toDomain(await this.repo.findOneOrFail({ id: existing.id }));
    }
    return toDomain(await this.repo.insert({ coopname, supplier_account, ...patch }));
  }
}

function toDomain(row: MarketplaceSupplierProfileEntity): MarketplaceSupplierProfileDomainEntity {
  return new MarketplaceSupplierProfileDomainEntity({
    id: row.id,
    coopname: row.coopname,
    supplier_account: row.supplier_account,
    display_name: row.display_name ?? null,
    about: row.about ?? '',
    cover: row.cover ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}
