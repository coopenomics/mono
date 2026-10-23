import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, CurrentUser, RequireRight, RightsGuard } from '@coopenomics/extension-kit';
import {
  CapitalOnboardingStepInputDTO,
  CapitalOnboardingStateDTO,
  SaveCapitalProgramDocDataInputDTO,
} from '../dto/onboarding.dto';
import { CapitalOnboardingService } from '../services/onboarding.service';
import type { IMonoAccount } from '@coopenomics/innercoop';

@Resolver()
export class CapitalOnboardingResolver {
  constructor(private readonly onboardingService: CapitalOnboardingService) {}

  @Query(() => CapitalOnboardingStateDTO, {
    name: 'getCapitalOnboardingState',
    description: 'Получить состояние онбординга capital',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('CapitalOnboarding', 'read')
  async getState(): Promise<CapitalOnboardingStateDTO> {
    return this.onboardingService.getState();
  }

  @Mutation(() => CapitalOnboardingStateDTO, {
    name: 'completeCapitalOnboardingStep',
    description: 'Выполнить шаг онбординга capital (создание предложения повестки)',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('CapitalOnboarding', 'update')
  async completeStep(
    @Args('data', { type: () => CapitalOnboardingStepInputDTO }) data: CapitalOnboardingStepInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<CapitalOnboardingStateDTO> {
    return this.onboardingService.completeStep(data, currentUser?.username);
  }

  @Mutation(() => CapitalOnboardingStateDTO, {
    name: 'saveCapitalProgramDocDataHash',
    description: 'Сохранить hash PrivateData параметров документов ЦПП',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('CapitalOnboarding', 'update')
  async saveProgramDocDataHash(
    @Args('data', { type: () => SaveCapitalProgramDocDataInputDTO }) data: SaveCapitalProgramDocDataInputDTO,
  ): Promise<CapitalOnboardingStateDTO> {
    return this.onboardingService.saveProgramDocDataHash(data.doc_data_hash);
  }
}
