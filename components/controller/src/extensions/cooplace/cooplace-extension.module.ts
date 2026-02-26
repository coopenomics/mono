import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MarketplaceSettingsResolver } from './application/resolvers/marketplace-settings.resolver';
import { ShipmentResolver } from './application/resolvers/shipment.resolver';
import { MarketplaceEventService } from './application/services/marketplace-event.service';
import { MatchService } from './domain/services/match.service';
import { CycleService } from './domain/services/cycle.service';
import { MARKETPLACE_SETTINGS_REPOSITORY } from './domain/repositories/marketplace-settings.repository';
import { MarketplaceSettingsTypeormEntity } from './infrastructure/entities/marketplace-settings.typeorm-entity';
import { MarketplaceSettingsTypeormRepository } from './infrastructure/adapters/marketplace-settings.typeorm-repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MarketplaceSettingsTypeormEntity,
    ]),
  ],
  providers: [
    MarketplaceSettingsResolver,
    ShipmentResolver,
    MarketplaceEventService,
    MatchService,
    CycleService,
    { provide: MARKETPLACE_SETTINGS_REPOSITORY, useClass: MarketplaceSettingsTypeormRepository },
  ],
  exports: [MatchService, CycleService],
})
export class CooplaceExtensionModule {}
