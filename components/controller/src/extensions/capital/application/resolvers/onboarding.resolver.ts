import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, CurrentUser } from '@coopenomics/extension-kit';
import {
  CapitalOnboardingStepInputDTO,
  CapitalOnboardingStateDTO,
  SaveCapitalProgramDocDataInputDTO,
} from '../dto/onboarding.dto';
import { CapitalOnboardingService } from '../services/onboarding.service';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';

@Resolver()
export class CapitalOnboardingResolver {
  constructor(private readonly onboardingService: CapitalOnboardingService) {}

  @Query(() => CapitalOnboardingStateDTO, {
    name: 'getCapitalOnboardingState',
    description: 'Получить состояние онбординга capital',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getState(): Promise<CapitalOnboardingStateDTO> {
    return this.onboardingService.getState();
  }

  @Mutation(() => CapitalOnboardingStateDTO, {
    name: 'completeCapitalOnboardingStep',
    description: 'Выполнить шаг онбординга capital (создание предложения повестки)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async completeStep(
    @Args('data', { type: () => CapitalOnboardingStepInputDTO }) data: CapitalOnboardingStepInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<CapitalOnboardingStateDTO> {
    return this.onboardingService.completeStep(data, currentUser?.username);
  }

  @Mutation(() => CapitalOnboardingStateDTO, {
    name: 'saveCapitalProgramDocDataHash',
    description: 'Сохранить hash PrivateData параметров документов ЦПП',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async saveProgramDocDataHash(
    @Args('data', { type: () => SaveCapitalProgramDocDataInputDTO }) data: SaveCapitalProgramDocDataInputDTO,
  ): Promise<CapitalOnboardingStateDTO> {
    return this.onboardingService.saveProgramDocDataHash(data.doc_data_hash);
  }
}
