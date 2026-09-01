import { describe, expect, it } from 'vitest'
import { isPasswordPolicyOk, PASSWORD_MIN_LENGTH, passwordPolicyErrors } from '../src/password-policy'

/** Зеркальный контракт: те же векторы обязаны давать те же вердикты в controller `password-policy.ts`. */
describe('passwordPolicyErrors — минимум 8, цифра, спецсимвол', () => {
  it('годные пароли', () => {
    for (const ok of ['Strong#Pass1', 'пароль-с-цифрой7', '12345678!', 'a1!aaaaa'])
      expect(passwordPolicyErrors(ok)).toEqual([])
  })

  it('короткий', () => {
    expect(passwordPolicyErrors('a1!a')).toEqual([`Минимум ${PASSWORD_MIN_LENGTH} символов`])
  })

  it('без цифры', () => {
    expect(passwordPolicyErrors('безцифры!!')).toEqual(['Хотя бы одна цифра'])
  })

  it('без спецсимвола (кириллица спецсимволом не считается)', () => {
    expect(passwordPolicyErrors('пароль123')).toEqual(['Хотя бы один спецсимвол (например !, ?, - или _)'])
    expect(isPasswordPolicyOk('NoSpecial123')).toBe(false)
  })

  it('пробел считается спецсимволом', () => {
    expect(passwordPolicyErrors('фраза из слов 42')).toEqual([])
  })
})
