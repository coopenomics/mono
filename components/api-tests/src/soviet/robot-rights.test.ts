/**
 * Права стола «Робот совета» снаружи (случаи robot.rights.* в test-registry/soviet.robot.yaml).
 *
 * Операции стола и права его страниц считаются из одной таблицы прав: член
 * совета читает реестр и журнал и ведёт свой ключ, председатель дополнительно
 * видит ключи совета, повторяет решения и делегирует подпись протоколов.
 * Рядовой пайщик стола не видит и на операции получает отказ.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COUNCIL, ROLES, caseName, gql, gqlError, tokenOf } from '../core'

const DESKTOP = 'query{ getDesktop{ workspaces{ name extension_name grants } } }'
const REGISTRY = 'query{ sovietRobotRegistry{ type } }'
const KEY_STATUS = 'query{ sovietRobotKeyStatus{ member } }'
const KEYS = 'query{ sovietRobotKeys{ member } }'

const NO_RIGHT = 'KIT_INSUFFICIENT_RIGHTS'

let chairman = ''
let council = ''
let member = ''

/** Права стола робота у пайщика; пусто — стола у него нет. */
async function robotGrants(token: string): Promise<string[]> {
  const desk = (await gql<any>(token, DESKTOP)).getDesktop
  const workspace = (desk.workspaces as any[]).find(w => w.extension_name === 'robot')
  return (workspace?.grants as string[] | undefined) ?? []
}

beforeAll(async () => {
  chairman = await tokenOf(CHAIRMAN)
  council = await tokenOf(COUNCIL)
  member = await tokenOf(ROLES.member())
}, 120_000)

describe('Робот совета: права по таблице', () => {
  it(caseName('robot.rights.happy.02', 'член совета получает права стола: реестр и журнал, свой голос и свой ключ'), async () => {
    const grants = await robotGrants(council)
    for (const grant of ['Robot:read', 'Robot:delegate', 'RobotKey:read:own', 'RobotKey:manage:own'])
      expect(grants, grant).toContain(grant)
    for (const grant of ['Robot:authorize', 'RobotKey:read:all', 'RobotDecision:retry'])
      expect(grants, grant).not.toContain(grant)
  })

  it(caseName('robot.rights.happy.03', 'председатель дополнительно получает подпись протоколов, ключи совета и повтор решений'), async () => {
    const grants = await robotGrants(chairman)
    for (const grant of ['Robot:read', 'Robot:delegate', 'Robot:authorize', 'RobotKey:read:all', 'RobotDecision:retry'])
      expect(grants, grant).toContain(grant)
  })

  it(caseName('robot.rights.side.05', 'рядовой пайщик прав стола не получает'), async () => {
    expect(await robotGrants(member)).toEqual([])
  })

  it(caseName('robot.rights.side.01', 'рядовой пайщик получает отказ на операции стола'), async () => {
    for (const query of [REGISTRY, KEY_STATUS, KEYS])
      expect(String((await gqlError(member, query))?.code), query).toBe(NO_RIGHT)
  })

  it(caseName('robot.rights.side.02', 'ключи всех членов совета видит председатель; члену совета отказ, свой ключ он читает'), async () => {
    expect(String((await gqlError(council, KEYS))?.code)).toBe(NO_RIGHT)
    expect(await gqlError(council, KEY_STATUS)).toBeNull()
    expect(await gqlError(chairman, KEYS)).toBeNull()
    expect(await gqlError(council, REGISTRY)).toBeNull()
  })
})
