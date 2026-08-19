/**
 * Единая парольная политика CoopID: минимум 8 символов, хотя бы одна цифра и
 * хотя бы один спецсимвол (не буква и не цифра — Unicode-aware, кириллица не
 * считается спецсимволом).
 *
 * Источник истины для клиента: регистрация, миграция «ключ→пароль», смена
 * пароля, восстановление. Серверная сторона (controller `password-policy.ts`) —
 * **зеркало** этих правил: controller собран как CJS и ESM-пакет импортировать
 * не может (тот же приём, что у `canonicalMigrationMessage`). Меняя правило
 * здесь — поменяй и зеркало.
 */

export const PASSWORD_MIN_LENGTH = 8

/**
 * Проверяет пароль по политике. Возвращает список человеко-читаемых нарушений
 * (пустой — пароль годен). Порядок стабильный: длина → цифра → спецсимвол.
 */
export function passwordPolicyErrors(password: string): string[] {
  const errors: string[] = []
  if (password.length < PASSWORD_MIN_LENGTH)
    errors.push(`Минимум ${PASSWORD_MIN_LENGTH} символов`)
  if (!/\d/.test(password))
    errors.push('Хотя бы одна цифра')
  if (!/[^\p{L}\p{N}]/u.test(password))
    errors.push('Хотя бы один спецсимвол (например !, ?, - или _)')
  return errors
}

/** Короткая подсказка под полем ввода — что требуется от пароля. */
export const PASSWORD_POLICY_HINT = `Минимум ${PASSWORD_MIN_LENGTH} символов, хотя бы одна цифра и один спецсимвол`

/** Пароль удовлетворяет политике целиком. */
export function isPasswordPolicyOk(password: string): boolean {
  return passwordPolicyErrors(password).length === 0
}
