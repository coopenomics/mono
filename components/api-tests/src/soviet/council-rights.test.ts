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
import { CHAIRMAN, COUNCIL, ROLES, caseName, gql, gqlError, tokenOf, waitFor } from '../core'
import type { Operation } from '../rights/schema'
import { SchemaModel } from '../rights/schema'

const NO_RIGHT = 'KIT_INSUFFICIENT_RIGHTS'
const NOT_OWN = 'KIT_RIGHT_SCOPE_OWN'
const THROTTLED = new Set(['429', 'GRAPHQL_RATE_LIMITED', 'THROTTLED'])
const DESKTOP = 'query{ getDesktop{ workspaces{ name extension_name grants } } }'
const COUNCIL_PAGES = ['Agenda:read', 'Participant:read:all', 'Document:read:all', 'DocumentTemplate:read', 'Meet:create']

const member: Who = ROLES.member()
const tokens: Record<string, string> = {}
let operations: Map<string, Operation>

/** Код отказа операции, вызванной с именем `username` в запросе; null — отказа прав нет. */
async function rightsDenial(who: Who, name: string, username: string): Promise<string | null> {
  const op = operations.get(name)
  if (!op)
    throw new Error(`операции ${name} нет в схеме`)
  const variables = structuredClone(op.variables) as { data: Record<string, unknown> }
  variables.data.username = username
  // Документы решений ограничены по частоте запросов: на отказ частоты
  // вызов повторяется, пока сервер не дойдёт до проверки прав.
  const code = await waitFor(async () => {
    const err = await gqlError(tokens[who.account], op.document, variables)
    const got = String(err?.code ?? '')
    return err?.httpStatus === 429 || THROTTLED.has(got) ? null : got
  }, { timeoutMs: 90_000, intervalMs: 5_000, label: `ответ ${name} без ограничения частоты` })
  return code === NO_RIGHT || code.startsWith('KIT_RIGHT_SCOPE_') ? code : null
}

async function sovietGrants(who: Who): Promise<string[]> {
  const desk = (await gql<any>(tokens[who.account], DESKTOP)).getDesktop
  const workspace = (desk.workspaces as any[]).find(w => w.extension_name === 'soviet')
  return (workspace?.grants as string[] | undefined) ?? []
}

beforeAll(async () => {
  for (const who of [CHAIRMAN, COUNCIL, member])
    tokens[who.account] = await tokenOf(who)
  operations = new Map((await SchemaModel.load(tokens[CHAIRMAN.account])).operations().map(o => [o.name, o]))
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
