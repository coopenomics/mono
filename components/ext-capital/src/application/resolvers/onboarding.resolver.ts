import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { CapitalOnboardingStepInputDTO, CapitalOnboardingStateDTO } from '../dto/onboarding.dto';
import { CapitalOnboardingService } from '../services/onboarding.service';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
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
}
