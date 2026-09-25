/**
 * Календарь кооператива в «Чате кооператива»: события привязаны к
 * незашифрованной комнате Matrix из реестра, лента ICS отдаётся по
 * персональной подписке с секретом в адресе (без токена — её опрашивают
 * календарные клиенты).
 *
 * На стенде сервера Matrix нет, реестр комнат пуст, поэтому событие создать
 * нельзя: здесь проверяется то, что от Matrix не зависит, — подписка ICS
 * (chatcoop_calendar_ics_subscriptions), чтение событий, отказы по комнате и
 * по роли.
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { API_URL, COUNCIL, ROLES, caseName, freshMember, gql, gqlError, tokenOf } from '../core'

const LIST = `query{ chatcoopListCalendarEvents{ id matrixRoomId title startsAt endsAt createdByUsername icsSequence } }`
const ROOMS = `query{ chatcoopListCalendarRooms{ matrixRoomId displayLabel } }`
const CREATE = `mutation($d:CreateChatCoopCalendarEventInput!){ chatcoopCreateCalendarEvent(data:$d){ id } }`
const UPDATE = `mutation($d:UpdateChatCoopCalendarEventInput!){ chatcoopUpdateCalendarEvent(data:$d){ id } }`
const DELETE = `mutation($id:String!){ chatcoopDeleteCalendarEvent(id:$id) }`
const ICS = `mutation{ chatcoopCreateCalendarIcsSubscription{ icsUrl } }`

/**
 * Адрес ленты строится от BACKEND_URL контроллера; тест ходит к тому же
 * серверу, что и GraphQL, — меняем только происхождение адреса.
 */
function feedUrl(icsUrl: string): URL {
  const u = new URL(icsUrl)
  const api = new URL(API_URL)
  u.protocol = api.protocol
  u.host = api.host
  return u
}

function eventInput(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    matrixRoomId: `!nosuchroom${crypto.randomBytes(4).toString('hex')}:matrix.local`,
    title: 'Собрание совета (api-tests)',
    description: 'Повестка: расходы участка',
    startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    ...over,
  }
}

describe('chatcoop: календарь и подписка ICS', () => {
  let me: Who
  let mine: string
  let member: string
  let council: string

  beforeAll(async () => {
    // Подписка ICS меняет состояние пайщика (секрет ленты) — свой пайщик.
    me = freshMember({ prefix: 'ics' })
    mine = await tokenOf(me)
    member = await tokenOf(ROLES.member())
    council = await tokenOf(COUNCIL)
  })

  it(caseName('chat.cal.happy.01', 'пайщик получает адрес ленты ICS, лента отдаётся без токена по секрету'), async () => {
    const d = await gql<any>(mine, ICS)
    const url = feedUrl(d.chatcoopCreateCalendarIcsSubscription.icsUrl)
    expect(url.pathname).toBe('/v1/extensions/chatcoop/calendar/feed.ics')
    expect(url.searchParams.get('id')).toBeTruthy()
    expect(url.searchParams.get('secret')).toMatch(/^[0-9a-f]{64}$/)

    const res = await fetch(url)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/calendar')
    const body = await res.text()
    expect(body.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(body).toContain('VERSION:2.0')
    expect(body.trimEnd().endsWith('END:VCALENDAR')).toBe(true)

    // События ленты — те же, что в списке календаря.
    const list = await gql<any>(mine, LIST)
    const vevents = (body.match(/BEGIN:VEVENT/g) ?? []).length
    expect(vevents).toBe(list.chatcoopListCalendarEvents.length)
  })

  it(caseName('chat.cal.happy.02', 'повторная выдача меняет секрет: старый адрес перестаёт работать, подписка та же'), async () => {
    const first = feedUrl((await gql<any>(mine, ICS)).chatcoopCreateCalendarIcsSubscription.icsUrl)
    const second = feedUrl((await gql<any>(mine, ICS)).chatcoopCreateCalendarIcsSubscription.icsUrl)
    expect(second.searchParams.get('id')).toBe(first.searchParams.get('id'))
    expect(second.searchParams.get('secret')).not.toBe(first.searchParams.get('secret'))
    expect((await fetch(first)).status).toBe(404)
    expect((await fetch(second)).status).toBe(200)
  })

  it(caseName('chat.cal.side.01', 'лента без секрета — 400, с чужим секретом или чужим id — 404'), async () => {
    const url = feedUrl((await gql<any>(mine, ICS)).chatcoopCreateCalendarIcsSubscription.icsUrl)

    const noSecret = new URL(url)
    noSecret.searchParams.delete('secret')
    expect((await fetch(noSecret)).status).toBe(400)

    const noId = new URL(url)
    noId.searchParams.delete('id')
    expect((await fetch(noId)).status).toBe(400)

    const wrongSecret = new URL(url)
    wrongSecret.searchParams.set('secret', crypto.randomBytes(32).toString('hex'))
    expect((await fetch(wrongSecret)).status).toBe(404)

    const wrongId = new URL(url)
    wrongId.searchParams.set('id', crypto.randomUUID())
    expect((await fetch(wrongId)).status).toBe(404)
  })

  it(caseName('chat.cal.side.02', 'у каждого пайщика своя подписка: секрет одного не открывает ленту другого'), async () => {
    const a = feedUrl((await gql<any>(mine, ICS)).chatcoopCreateCalendarIcsSubscription.icsUrl)
    const second = await tokenOf(freshMember({ prefix: 'ics' }))
    const b = feedUrl((await gql<any>(second, ICS)).chatcoopCreateCalendarIcsSubscription.icsUrl)
    expect(a.searchParams.get('id')).not.toBe(b.searchParams.get('id'))
    const cross = new URL(a)
    cross.searchParams.set('secret', b.searchParams.get('secret')!)
    expect((await fetch(cross)).status).toBe(404)
  })

  it(caseName('chat.cal.side.03', 'гость не получает адрес ленты и не читает календарь'), async () => {
    expect(String((await gqlError(null, ICS))?.code)).toBe('401')
    expect(String((await gqlError(null, LIST))?.code)).toBe('401')
  })

  it(caseName('chat.cal.happy.03', 'список событий читается пайщиком и советом одинаково'), async () => {
    const a = await gql<any>(mine, LIST)
    const b = await gql<any>(council, LIST)
    expect(Array.isArray(a.chatcoopListCalendarEvents)).toBe(true)
    expect(a.chatcoopListCalendarEvents.map((e: any) => e.id).sort()).toEqual(b.chatcoopListCalendarEvents.map((e: any) => e.id).sort())
  })

  it(caseName('chat.cal.side.04', 'события и комнаты календаря ведёт совет: пайщик получает отказ по роли'), async () => {
    expect((await gqlError(member, CREATE, { d: eventInput() }))?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
    expect((await gqlError(member, UPDATE, { d: { ...eventInput(), id: crypto.randomUUID() } }))?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
    expect((await gqlError(member, DELETE, { id: crypto.randomUUID() }))?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
    expect((await gqlError(member, ROOMS))?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
  })

  it(caseName('chat.cal.side.05', 'событие в комнате не из реестра не создаётся и не правится'), async () => {
    const input = eventInput()
    expect((await gqlError(council, CREATE, { d: input }))?.code).toBe('CHATCOOP_CALENDAR_ROOM_UNAVAILABLE')
    expect((await gqlError(council, UPDATE, { d: { ...eventInput(), id: crypto.randomUUID() } }))?.code).toBe('CHATCOOP_CALENDAR_ROOM_UNAVAILABLE')
    const list = await gql<any>(council, LIST)
    expect(list.chatcoopListCalendarEvents.some((e: any) => e.matrixRoomId === input.matrixRoomId)).toBe(false)
  })

  // До 25.09.2026 удаление несуществующего события отвечало «успех»
  // (решение владельца 25.09: должна быть ошибка, C28-80).
  it(caseName('chat.cal.side.07', 'удаление несуществующего события — отказ «не найдено»'), async () => {
    expect((await gqlError(council, DELETE, { id: crypto.randomUUID() }))?.code).toBe('CHATCOOP_CALENDAR_EVENT_NOT_FOUND')
  })
})
