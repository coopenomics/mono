import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { MarketplaceSupplierSettingsDomainRepository } from '../../domain/repositories/marketplace-supplier-settings.repository';
import { MarketplaceSupplierSettingsEntity } from '../entities/marketplace-supplier-settings.entity';

@Injectable()
export class MarketplaceSupplierSettingsRepositoryAdapter
  implements MarketplaceSupplierSettingsDomainRepository
{
  constructor(
    @InjectRepository(MarketplaceSupplierSettingsEntity, 'marketplace')
    private readonly repo: Repository<MarketplaceSupplierSettingsEntity>
  ) {}

  async getPayoutMethodId(coopname: string, username: string): Promise<string | null> {
    const row = await this.repo.findOne({ where: { coopname, username } });
    return row?.payout_method_id ?? null;
  }

  async setPayoutMethodId(
    coopname: string,
    username: string,
    method_id: string
  ): Promise<void> {
    const existing = await this.repo.findOne({ where: { coopname, username } });
    if (existing) {
      await this.repo.update({ id: existing.id }, { payout_method_id: method_id });
      return;
    }
    await this.repo.save(
      this.repo.create({ coopname, username, payout_method_id: method_id })
    );
  }
}
