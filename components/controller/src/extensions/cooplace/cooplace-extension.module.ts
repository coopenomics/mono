import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MarketplaceSettingsResolver } from './application/resolvers/marketplace-settings.resolver';
import { MARKETPLACE_SETTINGS_REPOSITORY } from './domain/repositories/marketplace-settings.repository';
import { MarketplaceSettingsTypeormEntity } from './infrastructure/entities/marketplace-settings.typeorm-entity';
import { MarketplaceSettingsTypeormRepository } from './infrastructure/adapters/marketplace-settings.typeorm-repository';

/**
 * CooplaceExtensionModule — бэкенд маркетплейса.
 *
 * Содержит:
 * - Настройки маркетплейса (policies, whitelist, categories)
 * - Карточки товаров (из marketplace extension) — TODO: подключить resolvers после адаптации импортов
 * - Категории и атрибуты
 * - Связь с блокчейном при match
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      MarketplaceSettingsTypeormEntity,
    ]),
  ],
  providers: [
    MarketplaceSettingsResolver,
    { provide: MARKETPLACE_SETTINGS_REPOSITORY, useClass: MarketplaceSettingsTypeormRepository },
  ],
  exports: [],
})
export class CooplaceExtensionModule {}
