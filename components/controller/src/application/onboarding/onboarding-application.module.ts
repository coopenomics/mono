import { Module } from '@nestjs/common';
import { ExtensionOnboardingResolver } from './resolvers/extension-onboarding.resolver';

/**
 * Application-модуль платформенного онбординга расширений: содержит
 * GraphQL-резолвер. ExtensionOnboardingService доступен глобально из
 * OnboardingDomainModule.
 */
@Module({
  providers: [ExtensionOnboardingResolver],
})
export class OnboardingApplicationModule {}
