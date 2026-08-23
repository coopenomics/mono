/**
 * Парольная политика CoopID, серверная сторона — **зеркало**
 * `@coopenomics/auth/password-policy` (клиентский пакет ESM-only, controller —
 * CJS; тот же приём, что у `canonicalMigrationMessage`). Меняя правило здесь —
 * поменяй и клиентский оригинал.
 *
 * Правила: минимум 8 символов, хотя бы одна цифра, хотя бы один спецсимвол
 * (не буква и не цифра — Unicode-aware, кириллица не считается спецсимволом).
 */

export const PASSWORD_MIN_LENGTH = 8;

/** Список нарушений политики (пустой — пароль годен). Порядок: длина → цифра → спецсимвол. */
export function passwordPolicyErrors(password: string): string[] {
  const errors: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) errors.push(`Минимум ${PASSWORD_MIN_LENGTH} символов`);
  if (!/\d/.test(password)) errors.push('Хотя бы одна цифра');
  if (!/[^\p{L}\p{N}]/u.test(password)) errors.push('Хотя бы один спецсимвол (например !, ?, - или _)');
  return errors;
}
