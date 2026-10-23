/**
 * Проверки отказов API, общие для наборов: отказ входа гостю и отказ с
 * доменным кодом. Код отказа проверки ввода приходит числом — сравнение строкой.
 */
import { expect } from 'vitest'
import type { GqlError } from './client'

/** Коды, которыми сервер отказывает в входе: истёкшая сессия, нет токена, гвард. */
export const AUTH_CODES = ['401', 'UNAUTHENTICATED', 'KIT_USER_NOT_AUTHORIZED', 'KIT_SESSION_ENDED']

export function expectAuthDenied(err: GqlError | null): void {
  expect(err, 'ожидался отказ входа').not.toBeNull()
  expect(AUTH_CODES, JSON.stringify(err)).toContain(String(err!.code))
}

export function expectCode(err: GqlError | null, code: string): void {
  expect(err, `ожидался отказ ${code}`).not.toBeNull()
  expect(String(err!.code), JSON.stringify(err)).toBe(code)
}
