import { Module } from '@nestjs/common';
import { ExtensionOnboardingResolver } from './resolvers/extension-onboarding.resolver';
import { CoreRightsModule } from '../rights/core-rights.module';

/**
 * Application-модуль платформенного онбординга расширений: содержит
 * GraphQL-резолвер. ExtensionOnboardingService доступен глобально из
 * OnboardingDomainModule.
 */
@Module({
  imports: [CoreRightsModule],
  providers: [ExtensionOnboardingResolver],
})
export class OnboardingApplicationModule {}
