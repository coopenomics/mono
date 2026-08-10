/**
 * Реестр шагов подключения расширения живёт в контракте
 * `@coopenomics/innercoop`: шаги объявляет расширение, ведёт их ядро. Здесь
 * порт доступен под привычными ядру именами.
 */
export {
  ONBOARDING_STEP_REGISTRY_PORT as ONBOARDING_STEP_REGISTRATION_PORT,
  type IOnboardingStepRegistryPort as OnboardingStepRegistrationPort,
} from '@coopenomics/innercoop';
