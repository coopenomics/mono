/**
 * Права ядра снаружи: глава совета (случаи core.rights.* в test-registry/core.council-rights.yaml).
 *
 * Операции собраний, решений и реестра документов стоят под таблицей прав
 * ядра. Обход «сам себе» прежнего гарда ролей заменён правом с охватом «своё»:
 * имя в запросе сверяется с вошедшим, и действовать за другого на узле не
 * может никто, включая совет. Вызовы строятся по схеме сервера, как в матрице
 * прав; подменяется только имя в запросе.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COUNCIL, ROLES, caseName, gql, tokenOf } from '../core'
import type { RightsProbe } from '../rights/probe'
import { NOT_OWN, NO_RIGHT, loadRightsProbe } from '../rights/probe'

const DESKTOP = 'query{ getDesktop{ workspaces{ name extension_name grants } } }'
const COUNCIL_PAGES = ['Agenda:read', 'Participant:read:all', 'Document:read:all', 'DocumentTemplate:read', 'Meet:create']

const member: Who = ROLES.member()
const tokens: Record<string, string> = {}
let probe: RightsProbe

/** Код отказа операции, вызванной с именем `username` в запросе; null — отказа прав нет. */
function rightsDenial(who: Who, name: string, username: string): Promise<string | null> {
  return probe.denial(tokens[who.account], name, { 'data.username': username })
}

async function sovietGrants(who: Who): Promise<string[]> {
  const desk = (await gql<any>(tokens[who.account], DESKTOP)).getDesktop
  const workspace = (desk.workspaces as any[]).find(w => w.extension_name === 'soviet')
  return (workspace?.grants as string[] | undefined) ?? []
}

beforeAll(async () => {
  for (const who of [CHAIRMAN, COUNCIL, member])
    tokens[who.account] = await tokenOf(who)
  probe = await loadRightsProbe(tokens[CHAIRMAN.account])
}, 180_000)

describe('ядро, совет: права по таблице', () => {
  it(caseName('core.rights.happy.02', 'пайщик на своё имя проходит права голоса и подписи уведомления о собрании'), async () => {
    // Документы собрания ограничены по частоте запросов, поэтому снаружи
    // проверяются голос и подпись уведомления; бюллетень и уведомление — в
    // модульном тесте.
    for (const name of ['voteOnAnnualGeneralMeet', 'notifyOnAnnualGeneralMeet'])
      expect(await rightsDenial(member, name, member.account), name).toBeNull()
  }, 240_000)

  it(caseName('core.rights.side.03', 'чужое имя в запросе — отказ пайщику, члену совета и председателю'), async () => {
    for (const name of ['voteOnAnnualGeneralMeet', 'notifyOnAnnualGeneralMeet']) {
      expect(await rightsDenial(member, name, COUNCIL.account), `${name}: пайщик`).toBe(NOT_OWN)
      expect(await rightsDenial(COUNCIL, name, member.account), `${name}: член совета`).toBe(NOT_OWN)
      expect(await rightsDenial(CHAIRMAN, name, member.account), `${name}: председатель`).toBe(NOT_OWN)
    }
    for (const name of ['signBySecretaryOnAnnualGeneralMeet', 'signByPresiderOnAnnualGeneralMeet'])
      expect(await rightsDenial(COUNCIL, name, CHAIRMAN.account), name).toBe(NOT_OWN)
  }, 240_000)

  it(caseName('core.rights.side.02', 'документ свободного решения рядовой пайщик не получает даже на своё имя'), async () => {
    expect(await rightsDenial(member, 'generateFreeDecision', member.account)).toBe(NO_RIGHT)
    expect(await rightsDenial(COUNCIL, 'generateFreeDecision', COUNCIL.account)).toBeNull()
  }, 240_000)

  it(caseName('core.rights.happy.04', 'реестр документов: совет читает документы любого пайщика, пайщик — свои'), async () => {
    expect(await rightsDenial(COUNCIL, 'getDocuments', member.account)).toBeNull()
    expect(await rightsDenial(member, 'getDocuments', member.account)).toBeNull()
    expect(await rightsDenial(member, 'getDocuments', COUNCIL.account)).toBe(NOT_OWN)
  }, 240_000)

  it(caseName('core.rights.happy.05', 'член совета получает права страниц стола совета'), async () => {
    const grants = await sovietGrants(COUNCIL)
    for (const grant of COUNCIL_PAGES)
      expect(grants, grant).toContain(grant)
  }, 240_000)

  it(caseName('core.rights.side.08', 'рядовой пайщик прав страниц стола совета не получает'), async () => {
    const grants = await sovietGrants(member)
    for (const grant of COUNCIL_PAGES)
      expect(grants, grant).not.toContain(grant)
  }, 240_000)
})
