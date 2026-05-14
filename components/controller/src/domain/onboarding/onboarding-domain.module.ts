import { Global, Module } from '@nestjs/common';
import { ExtensionDomainModule } from '~/domain/extension/extension-domain.module';
import { FreeDecisionInfrastructureModule } from '~/infrastructure/free-decision/free-decision-infrastructure.module';
import { DecisionTrackingInfrastructureModule } from '~/infrastructure/decision-tracking/decision-tracking-infrastructure.module';
import { OnboardingStepsRegistryService } from './services/onboarding-steps-registry.service';
import { ExtensionOnboardingService } from './services/extension-onboarding.service';
import { ExtensionOnboardingEventsService } from './services/extension-onboarding-events.service';
import { ONBOARDING_STEP_REGISTRATION_PORT } from './ports/onboarding-step-registration.port';
import { ONBOARDING_STEP_QUERY_PORT } from './ports/onboarding-step-query.port';

/**
 * Глобальный domain-модуль платформенного онбординга кооператива на
 * расширение.
 */
@Global()
@Module({
  imports: [
    ExtensionDomainModule,
    FreeDecisionInfrastructureModule,
    DecisionTrackingInfrastructureModule,
  ],
  providers: [
    OnboardingStepsRegistryService,
    {
      provide: ONBOARDING_STEP_REGISTRATION_PORT,
      useExisting: OnboardingStepsRegistryService,
    },
    {
      provide: ONBOARDING_STEP_QUERY_PORT,
      useExisting: OnboardingStepsRegistryService,
    },
    ExtensionOnboardingService,
    ExtensionOnboardingEventsService,
  ],
  exports: [
    OnboardingStepsRegistryService,
    ONBOARDING_STEP_REGISTRATION_PORT,
    ONBOARDING_STEP_QUERY_PORT,
    ExtensionOnboardingService,
  ],
})
export class OnboardingDomainModule {}
