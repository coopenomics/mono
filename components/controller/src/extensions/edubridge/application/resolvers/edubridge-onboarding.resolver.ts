import { Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlJwtAuthGuard, platformSettings } from '@coopenomics/extension-kit';
import { CurrentEduMember } from '../decorators/current-edu-member.decorator';
import { EduOnboardingStateDTO, EduSignOfferInputDTO } from '../dto/edu-onboarding.dto';
import { EdubridgeAccessGuard } from '../guards/edubridge-access.guard';
import type { IEdubridgeMembership } from '../membership/edubridge-membership.service';
import { EdubridgeOnboardingService } from '../services/edubridge-onboarding.service';

/** Подключение пайщика к столам: состояние оферт и подпись со стола. Доступно любому активному пайщику. */
@Resolver()
@Injectable()
export class EdubridgeOnboardingResolver {
  constructor(private readonly onboarding: EdubridgeOnboardingService) {}

  @Query(() => EduOnboardingStateDTO, { name: 'edubridgeOnboardingState', description: 'Подписаны ли оферты родителя-слушателя и преподавателя' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  edubridgeOnboardingState(@CurrentEduMember() member: IEdubridgeMembership): Promise<EduOnboardingStateDTO> {
    return this.onboarding.getState(platformSettings().coopname, member.username as string);
  }

  @Mutation(() => EduOnboardingStateDTO, { name: 'edubridgeSignOffer', description: 'Подписать оферту ЦПП «Образование» со стола' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  edubridgeSignOffer(
    @CurrentEduMember() member: IEdubridgeMembership,
    @Args('input') input: EduSignOfferInputDTO
  ): Promise<EduOnboardingStateDTO> {
    return this.onboarding.signOffer(platformSettings().coopname, member.username as string, input.kind, input.document);
  }
}
