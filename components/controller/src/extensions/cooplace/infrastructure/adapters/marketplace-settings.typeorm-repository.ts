import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketplaceSettingsTypeormEntity } from '../entities/marketplace-settings.typeorm-entity';
import type { MarketplaceSettingsRepository } from '../../domain/repositories/marketplace-settings.repository';
import type { MarketplaceSettingsEntity } from '../../domain/entities/marketplace-settings.entity';

@Injectable()
export class MarketplaceSettingsTypeormRepository implements MarketplaceSettingsRepository {
  constructor(
    @InjectRepository(MarketplaceSettingsTypeormEntity)
    private readonly repo: Repository<MarketplaceSettingsTypeormEntity>,
  ) {}

  async findByCoopname(coopname: string): Promise<MarketplaceSettingsEntity | null> {
    return (await this.repo.findOne({ where: { coopname } })) as unknown as MarketplaceSettingsEntity | null;
  }

  async upsert(settings: Partial<MarketplaceSettingsEntity> & { coopname: string }): Promise<MarketplaceSettingsEntity> {
    const existing = await this.repo.findOne({ where: { coopname: settings.coopname } });
    if (existing) {
      await this.repo.update(existing.id, settings as any);
      return (await this.repo.findOne({ where: { id: existing.id } }))! as unknown as MarketplaceSettingsEntity;
    }
    const entity = this.repo.create(settings as any);
    return (await this.repo.save(entity)) as unknown as MarketplaceSettingsEntity;
  }
}
