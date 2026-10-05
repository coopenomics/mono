import { TableStore } from '@coopenomics/extension-kit';
import { MARKETPLACE_SUPPLIER_SETTINGS_STORE } from '../../infrastructure/database/marketplace-stores';
import { Inject, Injectable } from '@nestjs/common';
import type { MarketplaceSupplierSettingsDomainRepository } from '../../domain/repositories/marketplace-supplier-settings.repository';
import { MarketplaceSupplierSettingsEntity } from '../entities/marketplace-supplier-settings.entity';

@Injectable()
export class MarketplaceSupplierSettingsRepositoryAdapter
  implements MarketplaceSupplierSettingsDomainRepository
{
  constructor(
    @Inject(MARKETPLACE_SUPPLIER_SETTINGS_STORE)
private readonly repo: TableStore<MarketplaceSupplierSettingsEntity>
  ) {}

  async getPayoutMethodId(coopname: string, username: string): Promise<string | null> {
    const row = await this.repo.findOne({ coopname, username });
    return row?.payout_method_id ?? null;
  }

  async setPayoutMethodId(
    coopname: string,
    username: string,
    method_id: string
  ): Promise<void> {
    const existing = await this.repo.findOne({ coopname, username });
    if (existing) {
      await this.repo.update({ id: existing.id }, { payout_method_id: method_id });
      return;
    }
    await this.repo.save(
      this.repo.create({ coopname, username, payout_method_id: method_id })
    );
  }
}
