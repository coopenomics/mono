import { Injectable, UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';

import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';

import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { MarketplaceCurrentMemberDTO } from '../dto/marketplace-current-member.dto';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';

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
  @Query(() => MarketplaceCurrentMemberDTO, {
    name: 'marketplaceWhoAmI',
    description: 'Контекст пайщика для Стола заказов: core_roles + marketplace_roles',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard)
  marketplaceWhoAmI(
    @CurrentMarketplaceMember() currentMember: IMarketplaceCurrentMember
  ): MarketplaceCurrentMemberDTO {
    return new MarketplaceCurrentMemberDTO(currentMember);
  }
}
