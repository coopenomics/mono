import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';

import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';

import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { MarketplaceCurrentMemberDTO } from '../dto/marketplace-current-member.dto';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import {
  MARKETPLACE_KU_CHAIRMAN_SERVICE,
  type MarketplaceKuChairmanService,
} from '../services/marketplace-ku-chairman.service';

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
    private readonly kuChairmanService: MarketplaceKuChairmanService
  ) {}

  @Query(() => MarketplaceCurrentMemberDTO, {
    name: 'marketplaceWhoAmI',
    description: 'Контекст пайщика для Стола заказов: core_roles + marketplace_roles + участки оператора',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard)
  async marketplaceWhoAmI(
    @CurrentMarketplaceMember() currentMember: IMarketplaceCurrentMember
  ): Promise<MarketplaceCurrentMemberDTO> {
    const branches = await this.kuChairmanService.listBranamesForMember(
      config.coopname,
      currentMember.username
    );
    return new MarketplaceCurrentMemberDTO({ ...currentMember, branches });
  }
}
