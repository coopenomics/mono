/**
 * Вход по карте кооператора снаружи (test-registry/cardcoop.entry.yaml).
 *
 * Кооператив стенда к сети card.coop не подключён: реквизитов клиента сеть ему
 * не выдавала. Поэтому снаружи проверяется всё, что обязано работать без
 * сети, — честная недоступность входа, отказ держателя и возврат с неначатым
 * входом ведут на страницу с флагом, а не в тупик; сессии, которых не было,
 * ничего не отдают. Шаги, где отвечает сама сеть (обмен кода, раскрытие
 * анкеты), на стенде непроверяемы.
 */
import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { COOP, caseName, gqlRaw } from '../core'
import { BASE_URL } from './cardcoop-card.helpers'


const ENTRY_BASE = `${BASE_URL}/v1/extensions/cardcoop/entry`

/** Куда уводит браузер ручка входа (без следования за редиректом). */
async function redirectOf(path: string): Promise<{ status: number, location: string }> {
  const res = await fetch(`${ENTRY_BASE}${path}`, { redirect: 'manual' })
  return { status: res.status, location: res.headers.get('location') ?? '' }
}

/** Страница входа по карте в столе этого кооператива. */
const entryPage = (query: string) => new RegExp(`/${COOP}/auth/cardcoop-entry\\?${query.replace('?', '\\?')}$`)

const ENTRY = `query($d: CardcoopEntryInput!){ cardcoopEntry(data: $d){ id outcome status cardNumber username memberships{ coopname } } }`
const TAKE_PROFILE = `mutation($d: CardcoopEntryInput!){ cardcoopTakeEntryProfile(data: $d){ subjectType profile } }`
const REQUEST_DISCLOSURE = `mutation($d: CardcoopRequestEntryDisclosureInput!){ cardcoopRequestEntryDisclosure(data: $d){ id status } }`

describe('cardcoop.entry: вход по карте без подключения к сети', () => {
  it(caseName('cc.entry.side.01', 'кооператив не подключён к сети: вход честно недоступен, кнопке некуда вести'), async () => {
    const available = await gqlRaw<{ cardcoopEntryAvailable: boolean }>(null, `query { cardcoopEntryAvailable }`)
    expect(available.errors).toEqual([])
    expect(available.data?.cardcoopEntryAvailable).toBe(false)

    // Начало входа не уводит на card.coop без реквизитов клиента — страница стола
    // объясняет, что вход по карте недоступен.
    const start = await redirectOf('/start')
    expect(start.status).toBe(302)
    expect(start.location).toMatch(entryPage('error=unavailable'))
  })

  it(caseName('cc.entry.side.01', 'отказ держателя на card.coop ведёт в «заполнить руками», а не в тупик'), async () => {
    const back = await redirectOf(`/callback?error=access_denied&state=${crypto.randomUUID()}`)
    expect(back.status).toBe(302)
    expect(back.location).toMatch(entryPage('error=cancelled'))

    // Возврат без кода — то же: сессии без кода не бывает.
    const noCode = await redirectOf(`/callback?state=${crypto.randomUUID()}`)
    expect(noCode.location).toMatch(entryPage('error=cancelled'))
  })

  it(caseName('cc.entry.side.01', 'возврат с state, которого кооператив не выдавал, не принимается'), async () => {
    const state = crypto.randomBytes(24).toString('base64url')
    const first = await redirectOf(`/callback?state=${state}&code=${crypto.randomUUID()}`)
    expect(first.status).toBe(302)
    expect(first.location).toMatch(entryPage('error=failed'))

    // Повтор того же возврата — тот же отказ: сессия входа не рождается.
    const again = await redirectOf(`/callback?state=${state}&code=${crypto.randomUUID()}`)
    expect(again.location).toMatch(entryPage('error=failed'))
    expect(again.location).not.toContain('entry=')
  })

  it(caseName('cc.entry.break.02', 'перебор идентификатора сессии получает отказ, а не анкету'), async () => {
    const guessed = crypto.randomUUID()

    const session = await gqlRaw(null, ENTRY, { d: { entry_id: guessed } })
    expect(session.data?.cardcoopEntry ?? null).toBeNull()
    expect(session.errors[0]?.code).toBe('CARDCOOP_ENTRY_SESSION_NOT_FOUND')

    const profile = await gqlRaw(null, TAKE_PROFILE, { d: { entry_id: guessed } })
    expect(profile.data?.cardcoopTakeEntryProfile ?? null).toBeNull()
    expect(profile.errors[0]?.code).toBe('CARDCOOP_ENTRY_SESSION_NOT_FOUND')

    // Повтор того же чтения ничего не меняет.
    const again = await gqlRaw(null, TAKE_PROFILE, { d: { entry_id: guessed } })
    expect(again.data?.cardcoopTakeEntryProfile ?? null).toBeNull()
    expect(again.errors[0]?.code).toBe('CARDCOOP_ENTRY_SESSION_NOT_FOUND')

    // Запрос раскрытия по чужой сессии тоже не уходит в сеть.
    const disclose = await gqlRaw(null, REQUEST_DISCLOSURE, { d: { entry_id: guessed, from_coopname: 'voskhod' } })
    expect(disclose.data?.cardcoopRequestEntryDisclosure ?? null).toBeNull()
    expect(disclose.errors[0]?.code).toBe('CARDCOOP_ENTRY_SESSION_NOT_FOUND')
  })
})
