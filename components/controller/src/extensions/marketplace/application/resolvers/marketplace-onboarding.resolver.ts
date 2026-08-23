import { Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlJwtAuthGuard,
  platformSettings,
} from '@coopenomics/extension-kit';

import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import { MarketplaceOnboardingStateDTO } from '../dto/marketplace-onboarding-state.dto';
import { MarketplaceSignOnboardingOfferInputDTO } from '../dto/marketplace-sign-onboarding-offer-input.dto';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceOnboardingService } from '../onboarding/marketplace-onboarding.service';

/**
 * Story 1.4: GraphQL endpoint L3 fallback онбординга + фоллоуап sign-mutation.
 *
 * AC: «UI вызывает `marketplaceOnboardingState(member_id)`». В нашей модели
 * member_id == JWT-пайщик из `MarketplaceMembershipGuard`, аргумент опущен —
 * сервер сам берёт username из context, фронт не должен подменять.
 *
 * Фоллоуап Эпика 1: `marketplaceSignOnboardingOffer` — пайщик подписывает
 * оферту ЦПП «Стол заказов» прямо со стола, минуя core registration-flow.
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

  /**
   * L3 fallback sign-mutation: пайщик акцептует оферту ЦПП «Стол заказов»
   * прямо со стола (`OnboardingMemberPickCpp`) после прохождения gate'а.
   *
   * Backend пишет on-chain `wallet::signagree` с `program_id=2` и шаблоном,
   * записанным в самой программе (1102 — персональный инстанс оферты). После
   * подтверждения транзакции синк подтянет подпись в PG; следующий
   * `marketplaceOnboardingState` ответит `source=AGREEMENT_SIGNED`.
   *
   * Возвращает свежее состояние онбординга — UI не нужно делать второй
   * запрос. Если sync ещё не успел (high-throughput edge case) — UI
   * перезапрашивает через короткую задержку.
   */
  @Mutation(() => MarketplaceOnboardingStateDTO, {
    name: 'marketplaceSignOnboardingOffer',
    description:
      'L3-подпись оферты ЦПП «Стол заказов» пайщиком после gate-диалога: on-chain wallet::signagree + ответ в виде обновлённого состояния онбординга',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard)
  async marketplaceSignOnboardingOffer(
    @CurrentMarketplaceMember() currentMember: IMarketplaceCurrentMember,
    @Args('input', { type: () => MarketplaceSignOnboardingOfferInputDTO })
    input: MarketplaceSignOnboardingOfferInputDTO
  ): Promise<MarketplaceOnboardingStateDTO> {
    await this.onboardingService.signOnboardingOffer({
      coopname: platformSettings().coopname,
      username: currentMember.username,
      document: input.document,
    });
    return this.onboardingService.getOnboardingState(currentMember.username);
  }
}
