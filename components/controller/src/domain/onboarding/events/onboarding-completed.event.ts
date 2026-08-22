/**
 * Событие завершения подключения расширения живёт в контракте
 * `@coopenomics/innercoop`: эмиттит его расширение, слушает ядро. Здесь
 * доступно под привычными ядру именами.
 */
export {
  ONBOARDING_COMPLETED_EVENT,
  type InnerOnboardingCompletedPayload as OnboardingCompletedPayload,
} from '@coopenomics/innercoop';
