/**
 * Срок подключения расширения — политика каркаса, живёт в
 * `@coopenomics/extension-kit`: он одинаков для всех расширений и не зависит
 * от ядра. Здесь доступен под привычными ядру именами.
 */
export { ONBOARDING_EXPIRY_DAYS, ONBOARDING_EXPIRY_MS, computeOnboardingExpiresAt } from '@coopenomics/extension-kit';
