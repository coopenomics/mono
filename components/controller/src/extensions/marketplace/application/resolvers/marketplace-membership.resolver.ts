import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';

import { GqlJwtAuthGuard, platformSettings } from '@coopenomics/extension-kit';

import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import {
  MarketplaceCurrentMemberDTO,
  MarketplaceWarehouseSettingsDTO,
} from '../dto/marketplace-current-member.dto';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import {
  MARKETPLACE_KU_CHAIRMAN_SERVICE,
  type MarketplaceKuChairmanService,
} from '../services/marketplace-ku-chairman.service';
import { MarketplaceWarehouseSettingsService } from '../services/marketplace-warehouse-settings.service';

/**
 * Story 1.3: тестовый whoami-эндпоинт расширения marketplace.
 *
 * Возвращает `MarketplaceCurrentMember` — то, что положил
 * `MarketplaceMembershipGuard` в context (username, core_roles, marketplace_roles).
 * Используется фронтом «Стола заказов», чтобы открыться на primary столе по
 * роли (AC-условие: «UI открывается на primary стол по marketplace-роли»).
 */
@Resolver()
@Injectable()
export class MarketplaceMembershipResolver {
  constructor(
    @Inject(MARKETPLACE_KU_CHAIRMAN_SERVICE)
    private readonly kuChairmanService: MarketplaceKuChairmanService,
    private readonly warehouseSettings: MarketplaceWarehouseSettingsService
  ) {}

  @Query(() => MarketplaceCurrentMemberDTO, {
    name: 'marketplaceWhoAmI',
    description:
      'Контекст пайщика для Стола заказов: роли, участки оператора и включённые настройки адресного хранения',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard)
  async marketplaceWhoAmI(
    @CurrentMarketplaceMember() currentMember: IMarketplaceCurrentMember
  ): Promise<MarketplaceCurrentMemberDTO> {
    const [branches, warehouse] = await Promise.all([
      this.kuChairmanService.listBranamesForMember(platformSettings().coopname, currentMember.username),
      this.warehouseSettings.get(),
    ]);
    return new MarketplaceCurrentMemberDTO({
      ...currentMember,
      branches,
      warehouse_settings: new MarketplaceWarehouseSettingsDTO(warehouse),
    });
  }
}
