/**
 * Форма шага подключения живёт в контракте `@coopenomics/innercoop`: её
 * заполняет расширение, читает ядро. Здесь она доступна под привычными ядру
 * именами.
 */
export type {
  InnerOnboardingStep as IExtensionOnboardingStepSpec,
  InnerOnboardingDecisionKind as OnboardingStepEventType,
  InnerOnboardingGenerator as OnboardingStepGenerator,
} from '@coopenomics/innercoop';
