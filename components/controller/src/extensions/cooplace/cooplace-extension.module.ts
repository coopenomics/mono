import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MarketplaceSettingsResolver } from './application/resolvers/marketplace-settings.resolver';
import { MatchService } from './domain/services/match.service';
import { CycleService } from './domain/services/cycle.service';
import { MARKETPLACE_SETTINGS_REPOSITORY } from './domain/repositories/marketplace-settings.repository';
import { MarketplaceSettingsTypeormEntity } from './infrastructure/entities/marketplace-settings.typeorm-entity';
import { MarketplaceSettingsTypeormRepository } from './infrastructure/adapters/marketplace-settings.typeorm-repository';

/**
 * CooplaceExtensionModule — бэкенд маркетплейса.
 *
 * Содержит:
 * - Настройки маркетплейса (policies, whitelist, categories)
 * - MatchService: каждая встречная заявка → сразу в блокчейн (блокировка средств)
 * - CycleService: min_units/deadline → порог для supply, не для match.
 *   При истечении цикла — cancel через блокчейн, возврат средств.
 * - Карточки/категории/атрибуты (из marketplace extension DTOs)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      MarketplaceSettingsTypeormEntity,
    ]),
  ],
  providers: [
    MarketplaceSettingsResolver,
    MatchService,
    CycleService,
    { provide: MARKETPLACE_SETTINGS_REPOSITORY, useClass: MarketplaceSettingsTypeormRepository },
  ],
  exports: [MatchService, CycleService],
})
export class CooplaceExtensionModule {}
