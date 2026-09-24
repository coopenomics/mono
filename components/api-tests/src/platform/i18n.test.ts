/**
 * Интернационализация отказов (platform.i18n): как отказ доходит до клиента.
 *
 * Сами словари, формы по числу и слияние проверяются юнит-тестами пакета
 * i18n — снаружи их не увидеть. Здесь — то, что видит клиент: код отказа,
 * HTTP-статус, параметры и текст из словаря с подставленными параметрами,
 * язык ответа по заголовку запроса и прежние отказы свободным текстом.
 */
import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { CHAIRMAN, ROLES, caseName, tokenOf } from '../core'
import { apiOrigin, gqlFull } from './platform-b.helpers'

const MARK_READ = `mutation($id:String!){ markNotificationRead(id:$id){ id } }`
const GET_REPORT = `query($id:String!){ getReport(id:$id){ id } }`

describe('platform.i18n: отказы доходят до клиента кодом и текстом из словаря', () => {
  it(caseName('plt.i18n.happy.02', 'DomainError: код, статус, параметры и текст словаря с подставленным параметром; в REST — то же рядом с message'), async () => {
    // Словарь ядра.
    const id = crypto.randomUUID()
    const r = await gqlFull(await tokenOf(ROLES.member()), MARK_READ, { id })
    expect(r.errors).toHaveLength(1)
    const e = r.errors[0]
    expect(e.extensions.code).toBe('NOTIFICATION_CENTER_INBOX_ITEM_NOT_FOUND')
    expect(e.extensions.status).toBe(404)
    expect(e.extensions.params).toEqual({ id })
    expect(e.message).toBe(`Уведомление инбокса '${id}' не найдено`)

    // Словарь расширения (отчёты) — тот же путь.
    const reportId = crypto.randomUUID()
    const rep = await gqlFull(await tokenOf(CHAIRMAN), GET_REPORT, { id: reportId })
    expect(rep.errors[0].extensions.code).toBe('REPORTS_REPORT_NOT_FOUND')
    expect(rep.errors[0].extensions.status).toBe(404)
    expect(rep.errors[0].extensions.params).toEqual({ id: reportId })
    expect(rep.errors[0].message).toBe(`Отчёт с id=${reportId} не найден`)

    // REST-ответ: code и params рядом с message.
    const res = await fetch(`${await apiOrigin()}/coop/vault/participant/nosuchvault${Date.now()}`)
    expect(res.status).toBe(404)
    const body: any = await res.json()
    expect(body.statusCode).toBe(404)
    expect(body.code).toBe('AUTH_V2_VAULT_NOT_FOUND')
    expect(body.params).toEqual({})
    expect(body.message).toBe('vault не найден')
  })

  it(caseName('plt.i18n.side.03', 'язык запроса: неподдерживаемый и смешанный Accept-Language дают русский, язык не протекает между запросами'), async () => {
    const token = await tokenOf(ROLES.member())
    const languages = ['en-US,en;q=0.9,ru;q=0.5', 'de-DE', 'en', 'ru-XA', 'zz', 'ru-RU,ru;q=0.9']
    // Запросы разом: у каждого свой язык и свой параметр, ответ собран из своих.
    const calls = languages.flatMap(lang => [0, 1].map(async () => {
      const id = crypto.randomUUID()
      const r = await gqlFull(token, MARK_READ, { id }, { 'Accept-Language': lang })
      return { lang, id, e: r.errors[0] }
    }))
    for (const { lang, id, e } of await Promise.all(calls)) {
      expect(e.extensions.code, lang).toBe('NOTIFICATION_CENTER_INBOX_ITEM_NOT_FOUND')
      expect(e.message, lang).toBe(`Уведомление инбокса '${id}' не найдено`)
    }
  })

  it(caseName('plt.i18n.side.05', 'прежний отказ без кода: текст как был, extensions.code — HTTP-статус числом, без params'), async () => {
    const r = await gqlFull(null, `query{ getExtensions{ name } }`)
    expect(r.errors).toHaveLength(1)
    const e = r.errors[0]
    expect(e.extensions.code).toBe(401)
    expect(e.extensions.status).toBe(401)
    expect(e.extensions.params).toBeUndefined()
    expect(e.message).toBe('Unauthorized')
  })
})
