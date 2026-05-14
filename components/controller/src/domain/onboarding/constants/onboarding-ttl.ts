/**
 * Платформенный TTL для L1-онбординга расширений.
 *
 * Один источник правды для capital и chairman (оба хардкодили
 * 30 * 24 * 60 * 60 * 1000 в своих модулях). При первом запуске
 * расширения сервис записывает `onboarding_expire_at` в config
 * плагина = startedAt + ONBOARDING_EXPIRY_MS; по истечении срока
 * `*-onboarding-events.service.isOnboardingExpired` возвращает true
 * и UI/процесс реагирует соответственно.
 *
 * Перенос в общий модуль (план C28-10 раздел 4.2) — чтобы изменение
 * политики (например, продление до 45 дней) не требовало правки
 * двух модулей и не дрейфовало по копиям.
 */

export const ONBOARDING_EXPIRY_DAYS = 30;

export const ONBOARDING_EXPIRY_MS = ONBOARDING_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

/**
 * Время истечения L1-онбординга, отталкиваясь от момента старта.
 * Возвращает ISO-строку, потому что в config'е плагина хранится строкой.
 */
export function computeOnboardingExpiresAt(startedAt: Date): string {
  return new Date(startedAt.getTime() + ONBOARDING_EXPIRY_MS).toISOString();
}
