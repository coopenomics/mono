/**
 * CoopID: наборы возможностей пайщика
 * (test-registry/coopid.capability-sets.yaml).
 *
 * Набор возможностей — именованный пакет прав («Бухгалтер», «Кассир»).
 * Председатель назначает набор пайщику и отзывает его; назначение может быть
 * срочным. Пайщик видит свой итоговый доступ — по нему рабочий стол решает,
 * какие столы и страницы показывать.
 *
 * Мир теста: свежий пайщик, которому назначают и отзывают наборы.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COUNCIL, ROLES, caseName, expectAuthDenied, expectCode, freshMember, gql, gqlError, tokenOf } from '../core'

const SETS = 'query{ getCapabilitySets{ set_key title description builtin coopname grants{ action resource } } }'
const ASSIGNED = 'query($u:String!){ getParticipantCapabilitySets(username:$u){ username set_key granted_by granted_at expires_at } }'
const MY_ACCESS = 'query{ getMyAccess{ sets grants{ action resource } } }'
const ASSIGN = 'mutation($d:AssignCapabilitySetInput!){ assignCapabilitySet(data:$d) }'
const REVOKE = 'mutation($d:RevokeCapabilitySetInput!){ revokeCapabilitySet(data:$d) }'

let chairman = ''
let council = ''
let member = ''
let target: Who
let targetToken = ''

/** Отказ гварда прав CoopID приходит кодом 403 без доменного имени. */
function denied(err: { code: string | null } | null): void {
  expect(err, 'ожидался отказ по правам').not.toBeNull()
  expect(['403', 'FORBIDDEN', 'KIT_INSUFFICIENT_RIGHTS']).toContain(String(err!.code))
}

async function access(): Promise<{ sets: string[], grants: { action: string, resource: string }[] }> {
  return (await gql<any>(targetToken, MY_ACCESS)).getMyAccess
}

async function assigned(): Promise<any[]> {
  return (await gql<any>(chairman, ASSIGNED, { u: target.account })).getParticipantCapabilitySets
}

function has(grants: { action: string, resource: string }[], action: string, resource: string): boolean {
  return grants.some(g => g.action === action && g.resource === resource)
}

beforeAll(async () => {
  chairman = await tokenOf(CHAIRMAN)
  council = await tokenOf(COUNCIL)
  member = await tokenOf(ROLES.member())
  target = freshMember({ prefix: 'caps' })
  targetToken = await tokenOf(target)
}, 300_000)

describe('CoopID — наборы возможностей', () => {
  it(caseName('coopid.caps.happy.01', 'каталог наборов отдаёт «Бухгалтера» и «Кассира» с правами, которые они открывают'), async () => {
    const sets = (await gql<any>(chairman, SETS)).getCapabilitySets as any[]
    const accountant = sets.find(s => s.set_key === 'accountant')
    const cashier = sets.find(s => s.set_key === 'cashier')
    expect(accountant).toMatchObject({ title: 'Бухгалтер', builtin: true })
    expect(has(accountant.grants, 'read', 'AccountingDesk')).toBe(true)
    expect(cashier).toMatchObject({ title: 'Кассир', builtin: true })
    expect(has(cashier.grants, 'read', 'PaymentRegistry')).toBe(true)
    expect(has(cashier.grants, 'confirm', 'PaymentRegistry')).toBe(true)
  })

  it(caseName('coopid.caps.happy.02', 'председатель назначает набор — он числится за пайщиком, и права набора появляются в его доступе'), async () => {
    const before = await access()
    expect(before.sets).toEqual([])
    expect(has(before.grants, 'read', 'AccountingDesk')).toBe(false)

    expect((await gql<any>(chairman, ASSIGN, { d: { username: target.account, set_key: 'accountant' } })).assignCapabilitySet).toBe(true)

    const list = await assigned()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ username: target.account, set_key: 'accountant', granted_by: CHAIRMAN.account, expires_at: null })
    expect(list[0].granted_at).toBeTruthy()

    const after = await access()
    expect(after.sets).toEqual(['accountant'])
    expect(has(after.grants, 'read', 'AccountingDesk')).toBe(true)
    expect(has(after.grants, 'confirm', 'PaymentRegistry'), 'права чужого набора не появились').toBe(false)
  })

  it(caseName('coopid.caps.side.01', 'повторное назначение того же набора не удваивает его'), async () => {
    await gql(chairman, ASSIGN, { d: { username: target.account, set_key: 'accountant' } })
    expect((await assigned()).filter(a => a.set_key === 'accountant')).toHaveLength(1)
    expect((await access()).sets).toEqual(['accountant'])
  })

  it(caseName('coopid.caps.happy.03', 'срочное назначение: до срока набор действует, истёкший — в доступ не входит'), async () => {
    const future = new Date(Date.now() + 24 * 3600_000).toISOString()
    await gql(chairman, ASSIGN, { d: { username: target.account, set_key: 'cashier', expires_at: future } })
    expect((await access()).sets.sort()).toEqual(['accountant', 'cashier'])
    expect(has((await access()).grants, 'confirm', 'PaymentRegistry')).toBe(true)
    const cashier = (await assigned()).find(a => a.set_key === 'cashier')
    expect(cashier.expires_at, 'срок назначения записан').toBeTruthy()
    expect(String(cashier.expires_at)).toContain(future.slice(0, 10))

    const past = new Date(Date.now() - 3600_000).toISOString()
    await gql(chairman, ASSIGN, { d: { username: target.account, set_key: 'cashier', expires_at: past } })
    const expired = await access()
    expect(expired.sets).toEqual(['accountant'])
    expect(has(expired.grants, 'confirm', 'PaymentRegistry'), 'права истёкшего набора сняты').toBe(false)
  })

  it(caseName('coopid.caps.happy.04', 'отзыв набора снимает его права; повторный отзыв — отказ'), async () => {
    expect((await gql<any>(chairman, REVOKE, { d: { username: target.account, set_key: 'accountant' } })).revokeCapabilitySet).toBe(true)
    const after = await access()
    expect(after.sets).toEqual([])
    expect(has(after.grants, 'read', 'AccountingDesk')).toBe(false)
    expect((await assigned()).filter(a => a.set_key === 'accountant'), 'отозванный набор за пайщиком не числится').toEqual([])

    expectCode(
      await gqlError(chairman, REVOKE, { d: { username: target.account, set_key: 'accountant' } }),
      'AUTH_V2_CAPABILITY_SET_NOT_ACTIVE',
    )
  })

  it(caseName('coopid.caps.side.02', 'набор, которого нет, и пустое имя пайщика — отказ своим кодом'), async () => {
    expectCode(
      await gqlError(chairman, ASSIGN, { d: { username: target.account, set_key: 'ghost-set' } }),
      'AUTH_V2_CAPABILITY_SET_NOT_FOUND',
    )
    expectCode(
      await gqlError(chairman, ASSIGN, { d: { username: '', set_key: 'accountant' } }),
      'AUTH_V2_USERNAME_REQUIRED',
    )
    expectCode(
      await gqlError(chairman, REVOKE, { d: { username: target.account, set_key: 'ghost-set' } }),
      'AUTH_V2_CAPABILITY_SET_NOT_ACTIVE',
    )
  })

  it(caseName('coopid.caps.side.03', 'наборами управляет только председатель — члену совета и пайщику отказ, гостю отказ входа'), async () => {
    for (const token of [council, member, targetToken]) {
      denied(await gqlError(token, ASSIGN, { d: { username: target.account, set_key: 'accountant' } }))
      denied(await gqlError(token, REVOKE, { d: { username: target.account, set_key: 'cashier' } }))
      denied(await gqlError(token, SETS))
      denied(await gqlError(token, ASSIGNED, { u: target.account }))
    }
    expectAuthDenied(await gqlError(null, MY_ACCESS))
    expectAuthDenied(await gqlError(null, ASSIGN, { d: { username: target.account, set_key: 'accountant' } }))
    expect((await access()).sets, 'чужие запросы доступ пайщика не изменили').toEqual([])
  })
})
