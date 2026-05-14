import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { ExtensionOnboardingService } from '~/domain/onboarding/services/extension-onboarding.service';
import { ExtensionOnboardingStateDTO } from '../dto/extension-onboarding-state.dto';
import { CompleteExtensionOnboardingStepInputDTO } from '../dto/complete-extension-onboarding-step.input';

/**
 * Универсальный GraphQL-резолвер платформенного онбординга кооператива
 * на расширение. Любое расширение, зарегистрировавшее шаги через
 * ONBOARDING_STEP_REGISTRATION_PORT в initialize(), сразу же
 * пользуется этим endpoint'ом без своего DTO/резолвера.
 *
 * Query open для chairman/member/user — frontend (включая обычного
 * пайщика) должен уметь увидеть, что кооператив ещё не онбординулся.
 * Mutation — только chairman (онбординг кооператива — компетенция
 * председателя).
 */
@Resolver()
export class ExtensionOnboardingResolver {
  constructor(private readonly onboardingService: ExtensionOnboardingService) {}

  @Query(() => ExtensionOnboardingStateDTO, {
    name: 'getExtensionOnboardingState',
    description: 'Получить состояние онбординга кооператива на расширение',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getState(
    @Args('extension_name', { type: () => String }) extension_name: string
  ): Promise<ExtensionOnboardingStateDTO> {
    const state = await this.onboardingService.getState(extension_name);
    return state as ExtensionOnboardingStateDTO;
  }

  @Mutation(() => ExtensionOnboardingStateDTO, {
    name: 'completeExtensionOnboardingStep',
    description:
      'Выполнить шаг онбординга кооператива на расширение (решение совета или общее собрание)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async completeStep(
    @Args('data', { type: () => CompleteExtensionOnboardingStepInputDTO })
    data: CompleteExtensionOnboardingStepInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<ExtensionOnboardingStateDTO> {
    const state = await this.onboardingService.completeStep(
      {
        extension_name: data.extension_name,
        step_key: data.step_key,
        title: data.title,
        question: data.question,
        decision: data.decision,
        proposal_hash: data.proposal_hash,
      },
      currentUser?.username
    );
    return state as ExtensionOnboardingStateDTO;
  }
}
