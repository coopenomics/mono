import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, CurrentUser } from '@coopenomics/extension-kit';
import {
  ChairmanOnboardingAgendaInputDTO,
  ChairmanOnboardingGeneralMeetInputDTO,
  ChairmanOnboardingStateDTO,
} from '../dto/onboarding.dto';
import { ChairmanOnboardingService } from '../services/onboarding.service';
import type { IMonoAccount } from '@coopenomics/innercoop';

@Resolver()
export class ChairmanOnboardingResolver {
  constructor(private readonly onboardingService: ChairmanOnboardingService) {}

  @Query(() => ChairmanOnboardingStateDTO, {
    name: 'getChairmanOnboardingState',
    description: 'Получить состояние онбординга председателя',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async getState(): Promise<ChairmanOnboardingStateDTO> {
    return this.onboardingService.getState();
  }

  @Mutation(() => ChairmanOnboardingStateDTO, {
    name: 'completeChairmanAgendaStep',
    description: 'Выполнить один из шагов онбординга (создание предложения повестки)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async completeAgendaStep(
    @Args('data', { type: () => ChairmanOnboardingAgendaInputDTO }) data: ChairmanOnboardingAgendaInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<ChairmanOnboardingStateDTO> {
    // Используем текущего пользователя как инициатора повестки
    return this.onboardingService.completeAgendaStep(data, currentUser?.username);
  }

  @Mutation(() => ChairmanOnboardingStateDTO, {
    name: 'completeChairmanGeneralMeetStep',
    description: 'Выполнить шаг онбординга по созданию общего собрания (сохранить hash повестки)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async completeGeneralMeetStep(
    @Args('data', { type: () => ChairmanOnboardingGeneralMeetInputDTO }) data: ChairmanOnboardingGeneralMeetInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<ChairmanOnboardingStateDTO> {
    return this.onboardingService.completeGeneralMeet(data.proposal_hash, currentUser?.username);
  }
}
