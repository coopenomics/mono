/**
 * Юнит-тест TTL онбординга (Эпик 4.2).
 *
 * Проверяет:
 *   (a) ONBOARDING_EXPIRY_DAYS = 30 (зафиксировано как платформенное значение);
 *   (b) computeOnboardingExpiresAt возвращает корректную ISO-строку;
 *   (c) разница между startedAt и expiresAt = 30 дней в миллисекундах,
 *       что эквивалентно тому, что было захардкожено в capital и chairman
 *       до консолидации.
 */

import {
  ONBOARDING_EXPIRY_DAYS,
  ONBOARDING_EXPIRY_MS,
  computeOnboardingExpiresAt,
} from '~/domain/onboarding/constants/onboarding-ttl';

describe('Onboarding TTL', () => {
  it('ONBOARDING_EXPIRY_DAYS = 30', () => {
    expect(ONBOARDING_EXPIRY_DAYS).toBe(30);
  });

  it('ONBOARDING_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000', () => {
    expect(ONBOARDING_EXPIRY_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('computeOnboardingExpiresAt возвращает ISO-строку через 30 дней от startedAt', () => {
    const startedAt = new Date('2026-01-01T00:00:00.000Z');
    const expiresAt = computeOnboardingExpiresAt(startedAt);

    expect(expiresAt).toBe('2026-01-31T00:00:00.000Z');
  });

  it('expiresAt − startedAt = ONBOARDING_EXPIRY_MS (eq. старому хардкоду)', () => {
    const startedAt = new Date('2026-05-12T12:34:56.789Z');
    const expiresAt = new Date(computeOnboardingExpiresAt(startedAt));

    expect(expiresAt.getTime() - startedAt.getTime()).toBe(ONBOARDING_EXPIRY_MS);
  });
});
