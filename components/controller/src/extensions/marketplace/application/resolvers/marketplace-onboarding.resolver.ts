import { Injectable, UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';

import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';

import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import { MarketplaceOnboardingStateDTO } from '../dto/marketplace-onboarding-state.dto';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceOnboardingService } from '../onboarding/marketplace-onboarding.service';

/**
 * Story 1.4: GraphQL endpoint L3 fallback онбординга.
 *
 * AC: «UI вызывает `marketplaceOnboardingState(member_id)`». В нашей модели
 * member_id == JWT-пайщик из `MarketplaceMembershipGuard`, аргумент опущен —
 * сервер сам берёт username из context, фронт не должен подменять.
 */
@Resolver()
@Injectable()
export class MarketplaceOnboardingResolver {
  constructor(private readonly onboardingService: MarketplaceOnboardingService) {}

  @Query(() => MarketplaceOnboardingStateDTO, {
    name: 'marketplaceOnboardingState',
    description:
      'Состояние онбординга пайщика в Столе заказов: показывать ли gate или пропускать на стол',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard)
  marketplaceOnboardingState(
    @CurrentMarketplaceMember() currentMember: IMarketplaceCurrentMember
  ): Promise<MarketplaceOnboardingStateDTO> {
    return this.onboardingService.getOnboardingState(currentMember.username);
  }
}
