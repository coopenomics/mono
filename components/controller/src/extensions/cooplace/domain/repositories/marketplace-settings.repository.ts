import type { MarketplaceSettingsEntity } from '../entities/marketplace-settings.entity';

export interface MarketplaceSettingsRepository {
  findByCoopname(coopname: string): Promise<MarketplaceSettingsEntity | null>;
  upsert(settings: Partial<MarketplaceSettingsEntity> & { coopname: string }): Promise<MarketplaceSettingsEntity>;
}

export const MARKETPLACE_SETTINGS_REPOSITORY = Symbol('MarketplaceSettingsRepository');
