/**
 * Стол заказов: пункт выдачи участка — режим работы, описание, статус и
 * место на карте (test-registry/marketplace.ku-details.yaml).
 *
 * Председатель описывает пункт выдачи участка и включает его; пайщики видят
 * только включённые пункты. Место на карте берётся из адреса участка:
 * платформа спрашивает геокодер и запоминает координаты либо причину отказа,
 * а председатель может повторить запрос.
 *
 * Мир теста: участок myt из засева стенда. Геокодер на стенде играет
 * подставной узел. Набор возвращает пункту исходное описание и статус.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, COUNCIL, ROLES, caseName, expectCode, gql, gqlError, stubRequests, stubReset, stubRoute, tokenOf, waitFor } from '../core'

const KU = 'coopname coreBraname description status geocodeStatus geocodeErrorMessage geocodedAt lat lng workingHours{ mon{ open close breaks{ start end } } sat{ open close } sun{ open close } }'
const DETAIL = `mutation($d:MarketplaceDetailKUInput!){ marketplaceDetailKU(data:$d){ ${KU} } }`
const SET_STATUS = `mutation($d:MarketplaceSetKUStatusInput!){ marketplaceSetKUStatus(data:$d){ ${KU} } }`
const RETRY = `mutation($c:String!,$b:String!){ marketplaceRetryKUGeocode(coopname:$c, coreBraname:$b){ ${KU} } }`
const LIST = `query($d:ListMarketplaceKUInput!){ marketplaceListKUDetails(data:$d){ ${KU} } }`

const BRANCHES = 'query($d:GetBranchesInput!){ getBranches(data:$d){ braname email fact_address full_name short_name phone trustee{ username } represented_by{ based_on } } }'
const EDIT_BRANCH = 'mutation($d:EditBranchInput!){ editBranch(data:$d){ braname fact_address } }'

const BRANCH = 'myt'
const GEOCODER_PATH = '/geocoder'

let chairman = ''
let council = ''
let member = ''
let original: any
let branchBefore: any

function branchInput(b: any, factAddress: string) {
  return {
    d: {
      coopname: COOP,
      braname: BRANCH,
      based_on: b.represented_by.based_on,
      email: b.email,
      fact_address: factAddress,
      full_name: b.full_name,
      short_name: b.short_name,
      phone: b.phone,
      trustee: b.trustee.username,
    },
  }
}

async function ku(token: string, onlyActive: boolean): Promise<any | undefined> {
  const d = await gql<any>(token, LIST, { d: { coopname: COOP, onlyActive } })
  return (d.marketplaceListKUDetails as any[]).find(k => k.coreBraname === BRANCH)
}

function hours(monClose: string) {
  return {
    mon: { open: '08:00', close: monClose, breaks: [{ start: '13:00', end: '14:00' }] },
    sat: { open: '10:00', close: '15:00', breaks: [] },
  }
}

function geocoderAnswer(pos: string) {
  return { body: { response: { GeoObjectCollection: { featureMember: [{ GeoObject: { Point: { pos } } }] } } } }
}

beforeAll(async () => {
  chairman = await tokenOf(CHAIRMAN)
  council = await tokenOf(COUNCIL)
  member = await tokenOf(ROLES.member())
  original = await ku(chairman, false)
  expect(original, 'пункт выдачи участка заведён засевом стенда').toBeTruthy()
})

afterAll(async () => {
  if (branchBefore)
    await gqlError(chairman, EDIT_BRANCH, branchInput(branchBefore, branchBefore.fact_address))
  if (!original)
    return
  await gqlError(chairman, DETAIL, {
    d: { coopname: COOP, coreBraname: BRANCH, description: original.description, workingHours: { mon: { open: '09:00', close: '18:00', breaks: [] }, sat: { open: '10:00', close: '16:00', breaks: [] } } },
  })
  await gqlError(chairman, SET_STATUS, { d: { coopname: COOP, coreBraname: BRANCH, status: original.status } })
  await stubReset()
})

describe('Стол заказов — пункт выдачи участка', () => {
  it(caseName('mkt.ku.happy.01', 'председатель правит режим работы и описание пункта — статус пункта не меняется, правка видна пайщику'), async () => {
    const saved = (await gql<any>(chairman, DETAIL, {
      d: { coopname: COOP, coreBraname: BRANCH, description: 'Вход со двора', workingHours: hours('20:00') },
    })).marketplaceDetailKU
    expect(saved).toMatchObject({ coopname: COOP, coreBraname: BRANCH, description: 'Вход со двора', status: original.status })
    expect(saved.workingHours.mon).toEqual({ open: '08:00', close: '20:00', breaks: [{ start: '13:00', end: '14:00' }] })
    expect(saved.workingHours.sun, 'день без режима — выходной').toBeNull()

    const seen = await ku(member, false)
    expect(seen).toMatchObject({ description: 'Вход со двора' })
    expect(seen.workingHours.mon.close).toBe('20:00')
  })

  it(caseName('mkt.ku.happy.02', 'выключенный пункт пайщик среди действующих не видит; включённый — видит'), async () => {
    const off = (await gql<any>(chairman, SET_STATUS, { d: { coopname: COOP, coreBraname: BRANCH, status: 'INACTIVE' } })).marketplaceSetKUStatus
    expect(off.status).toBe('INACTIVE')
    expect(await ku(member, true), 'среди действующих пункта нет').toBeUndefined()
    expect((await ku(chairman, false))?.status, 'в полном списке пункт остался').toBe('INACTIVE')

    const on = (await gql<any>(chairman, SET_STATUS, { d: { coopname: COOP, coreBraname: BRANCH, status: 'ACTIVE' } })).marketplaceSetKUStatus
    expect(on.status).toBe('ACTIVE')
    expect((await ku(member, true))?.status).toBe('ACTIVE')
    expect((await ku(member, true)).description, 'смена статуса описание не трогает').toBe('Вход со двора')
  })

  it(caseName('mkt.ku.happy.03', 'повтор запроса места на карте: геокодер ответил — координаты записаны, причина прежнего отказа снята'), async () => {
    await stubRoute('GET', GEOCODER_PATH, geocoderAnswer('37.7365 55.9105'))
    const located = (await gql<any>(chairman, RETRY, { c: COOP, b: BRANCH })).marketplaceRetryKUGeocode
    expect(located.geocodeStatus).toBe('OK')
    expect(located.lat).toBeCloseTo(55.9105, 4)
    expect(located.lng).toBeCloseTo(37.7365, 4)
    expect(located.geocodedAt).toBeTruthy()
    expect(located.geocodeErrorMessage, 'у найденного места причины отказа нет').toBeNull()

    const asked = (await stubRequests(GEOCODER_PATH)).at(-1)!
    expect(asked.query.geocode, 'геокодеру ушёл адрес участка').toBeTruthy()
    expect(asked.query.format).toBe('json')
    expect(await ku(member, true)).toMatchObject({ geocodeStatus: 'OK' })
  })

  it(caseName('mkt.ku.side.01', 'геокодер отказал или не нашёл адрес — пункт помечен отказом с причиной, сам пункт работает'), async () => {
    await stubRoute('GET', GEOCODER_PATH, { status: 503, body: { message: 'unavailable' } })
    const failed = (await gql<any>(chairman, RETRY, { c: COOP, b: BRANCH })).marketplaceRetryKUGeocode
    expect(failed.geocodeStatus).toBe('FAILED')
    expect(failed.geocodeErrorMessage).toContain('503')
    expect(failed.status, 'отказ геокодера пункт не выключает').toBe('ACTIVE')

    await stubRoute('GET', GEOCODER_PATH, { body: { response: { GeoObjectCollection: { featureMember: [] } } } })
    const empty = (await gql<any>(chairman, RETRY, { c: COOP, b: BRANCH })).marketplaceRetryKUGeocode
    expect(empty.geocodeStatus).toBe('FAILED')
    expect(empty.geocodeErrorMessage).toBeTruthy()

    // Оставляем пункт с найденным местом — как после исправной работы геокодера.
    await stubRoute('GET', GEOCODER_PATH, geocoderAnswer('37.7365 55.9105'))
    expect((await gql<any>(chairman, RETRY, { c: COOP, b: BRANCH })).marketplaceRetryKUGeocode.geocodeStatus).toBe('OK')
  })

  it(caseName('mkt.ku.side.04', 'у участка сменили адрес — при следующем чтении списка место на карте запрошено заново по новому адресу'), async () => {
    const d = await gql<any>(chairman, BRANCHES, { d: { coopname: COOP, braname: BRANCH } })
    branchBefore = d.getBranches[0]
    const moved = `${branchBefore.fact_address}, корп. ${Date.now().toString(36)}`
    await stubRoute('GET', GEOCODER_PATH, geocoderAnswer('37.8000 55.9900'))

    const edited = await gql<any>(chairman, EDIT_BRANCH, branchInput(branchBefore, moved))
    expect(edited.editBranch.fact_address).toBe(moved)

    // Чтение списка замечает расхождение адреса и перезапускает запрос места.
    const relocated = await waitFor(async () => {
      const k = await ku(member, true)
      return k && Math.abs(Number(k.lat) - 55.99) < 1e-4 ? k : null
    }, { timeoutMs: 60_000, intervalMs: 1_500, label: 'место на карте по новому адресу' })
    expect(relocated.geocodeStatus).toBe('OK')
    expect(relocated.lng).toBeCloseTo(37.8, 4)
    const asked = (await stubRequests(GEOCODER_PATH)).at(-1)!
    expect(asked.query.geocode).toBe(moved)
  })

  it(caseName('mkt.ku.side.02', 'пункт выдачи ведёт только председатель — члену совета и пайщику отказ, пункт не меняется'), async () => {
    for (const token of [council, member]) {
      expectCode(await gqlError(token, DETAIL, { d: { coopname: COOP, coreBraname: BRANCH, description: 'чужая правка', workingHours: hours('21:00') } }), 'KIT_INSUFFICIENT_RIGHTS')
      expectCode(await gqlError(token, SET_STATUS, { d: { coopname: COOP, coreBraname: BRANCH, status: 'INACTIVE' } }), 'KIT_INSUFFICIENT_RIGHTS')
      expectCode(await gqlError(token, RETRY, { c: COOP, b: BRANCH }), 'KIT_INSUFFICIENT_RIGHTS')
    }
    expect(await ku(chairman, false)).toMatchObject({ description: 'Вход со двора', status: 'ACTIVE' })
  })

  it(caseName('mkt.ku.side.03', 'чужой кооператив, участок, которого нет, и участок без пункта — отказ своим кодом'), async () => {
    expectCode(
      await gqlError(chairman, DETAIL, { d: { coopname: 'othercoop', coreBraname: BRANCH, workingHours: hours('20:00') } }),
      'MARKETPLACE_FOREIGN_COOP_REQUEST_REJECTED',
    )
    expectCode(
      await gqlError(chairman, DETAIL, { d: { coopname: COOP, coreBraname: 'ghostbranch', workingHours: hours('20:00') } }),
      'MARKETPLACE_BRANCH_NOT_FOUND',
    )
    expectCode(
      await gqlError(chairman, SET_STATUS, { d: { coopname: COOP, coreBraname: 'ghostbranch', status: 'ACTIVE' } }),
      'MARKETPLACE_KU_DETAILS_NOT_FOUND',
    )
    expectCode(
      await gqlError(chairman, RETRY, { c: COOP, b: 'ghostbranch' }),
      'MARKETPLACE_KU_DETAILS_NOT_FOUND',
    )
    expectCode(
      await gqlError(chairman, LIST, { d: { coopname: 'othercoop' } }),
      'MARKETPLACE_FOREIGN_COOP_REQUEST_REJECTED',
    )
  })
})
