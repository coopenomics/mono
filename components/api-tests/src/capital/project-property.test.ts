/**
 * Благорост: имущественный взнос в проект
 * (test-registry/capital.project-property.yaml).
 *
 * Участник проекта предлагает внести имущество: описание и стоимость.
 * Предложение уходит председателю; после одобрения стоимость ложится в
 * имущественную базу проекта и в долю участника, а само предложение
 * закрывается.
 *
 * Мир теста: запущенный проект в цепи и участник Благороста с допуском.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, ROLES, amount, caseName, expectCode, gql, gqlError, tableRows, tokenOf, waitFor } from '../core'
import { approveAsChairman, tag, waitApprovalVisible } from './cap-access.helpers'
import {
  capitalMember,
  clearance,
  createProject,
  ensureCapitalProgram,
  randomHash,
  setMasterInChain,
  setPlan,
  startProject,
} from './cap-results.helpers'

const CREATE = 'mutation($d:CreateProjectPropertyInput!){ capitalCreateProjectProperty(data:$d){ __typename } }'
const PROJECT = 'query($d:GetProjectInput!){ capitalProject(data:$d){ status fact{ property_base_pool } } }'
const SEGMENT = 'query($f:CapitalSegmentFilter){ capitalSegment(filter:$f){ username is_propertor property_base } }'
const DECLINE = 'mutation($d:DeclineApproveInput!){ chairmanDeclineApprove(data:$d){ approval_hash } }'

const VALUE = 15_000

let member: Who
let memberToken = ''
let chairmanToken = ''
let project = ''
let propertyHash = ''
let pendingHash = ''

function input(hash: string, over: Record<string, unknown> = {}) {
  return {
    d: {
      coopname: COOP,
      username: member.account,
      project_hash: project,
      property_hash: hash,
      property_amount: `${VALUE.toFixed(4)} RUB`,
      property_description: 'Станок токарный, б/у',
      ...over,
    },
  }
}

async function chainProperty(hash: string): Promise<any | undefined> {
  const rows = await tableRows<any>('capital', COOP, 'pjproperties')
  return rows.find(r => String(r.property_hash).toLowerCase() === hash.toLowerCase())
}

async function propertyPool(): Promise<number> {
  const d = await gql<any>(chairmanToken, PROJECT, { d: { hash: project } })
  return amount(d.capitalProject.fact.property_base_pool)
}

beforeAll(async () => {
  await ensureCapitalProgram()
  chairmanToken = await tokenOf(CHAIRMAN)
  member = await capitalMember('cprp')
  memberToken = await tokenOf(member)
  project = await createProject(`Имущество ${tag('prop')}`)
  await clearance(member, project)
  await setMasterInChain(project, member)
  await setPlan(project, member)
  await startProject(project)
  await waitFor(async () => {
    const d = await gql<any>(chairmanToken, PROJECT, { d: { hash: project } })
    return d.capitalProject?.status === 'ACTIVE' ? true : null
  }, { timeoutMs: 120_000, intervalMs: 1_000, label: 'проект запущен в зеркале' })
}, 900_000)

describe('Благорост — имущественный взнос в проект', () => {
  it(caseName('cap.prop.happy.01', 'участник предлагает имущество — предложение заведено и ждёт председателя, база проекта не тронута'), async () => {
    propertyHash = randomHash()
    const before = await propertyPool()
    await gql(memberToken, CREATE, input(propertyHash))

    const row = await chainProperty(propertyHash)
    expect(row, 'предложение записано').toBeTruthy()
    expect(row).toMatchObject({ username: member.account, property_description: 'Станок токарный, б/у' })
    expect(amount(row.property_amount)).toBe(VALUE)
    expect(await propertyPool(), 'до одобрения база проекта прежняя').toBe(before)
  })

  it(caseName('cap.prop.happy.02', 'председатель одобрил — стоимость легла в имущественную базу проекта и в долю участника, предложение закрыто'), async () => {
    const before = await propertyPool()
    await waitApprovalVisible(propertyHash)
    await approveAsChairman(propertyHash)

    await waitFor(async () => (await propertyPool()) === before + VALUE ? true : null,
      { timeoutMs: 120_000, intervalMs: 1_000, label: 'имущественная база проекта выросла' })
    const segment = await waitFor(async () => {
      const d = await gql<any>(chairmanToken, SEGMENT, { f: { project_hash: project, username: member.account } })
      return d.capitalSegment?.is_propertor ? d.capitalSegment : null
    }, { timeoutMs: 120_000, intervalMs: 1_000, label: 'доля участника с имуществом в зеркале' })
    expect(amount(segment.property_base)).toBe(VALUE)
    expect(await chainProperty(propertyHash), 'одобренное предложение закрыто').toBeUndefined()
  })

  it(caseName('cap.prop.side.01', 'предложение от чужого имени — отказ по правам, предложение не заводится'), async () => {
    const hash = randomHash()
    const stranger = await tokenOf(ROLES.member())
    expectCode(await gqlError(stranger, CREATE, input(hash)), 'KIT_INSUFFICIENT_RIGHTS')
    expect(await chainProperty(hash)).toBeUndefined()
  })

  it(caseName('cap.prop.side.02', 'нулевая стоимость, пустое описание и повтор хеша предложения — отказ цепи, предложение не заводится'), async () => {
    const zero = randomHash()
    expect(await gqlError(memberToken, CREATE, input(zero, { property_amount: '0.0000 RUB' })), 'нулевая стоимость').not.toBeNull()
    expect(await chainProperty(zero)).toBeUndefined()

    const blank = randomHash()
    expect(await gqlError(memberToken, CREATE, input(blank, { property_description: '' })), 'пустое описание').not.toBeNull()
    expect(await chainProperty(blank)).toBeUndefined()

    pendingHash = randomHash()
    await gql(memberToken, CREATE, input(pendingHash))
    expect(await gqlError(memberToken, CREATE, input(pendingHash)), 'повтор хеша').not.toBeNull()
  })

  it(caseName('cap.prop.side.04', 'председатель отклонил предложение — оно закрыто, база проекта не изменилась'), async () => {
    const before = await propertyPool()
    await waitApprovalVisible(pendingHash)
    await gql(chairmanToken, DECLINE, { d: { coopname: COOP, approval_hash: pendingHash, reason: 'Имущество проекту не требуется' } })

    await waitFor(async () => (await chainProperty(pendingHash)) ? null : true,
      { timeoutMs: 120_000, intervalMs: 1_000, label: 'отклонённое предложение закрыто' })
    expect(await propertyPool()).toBe(before)
  })

  it(caseName('cap.prop.side.03', 'пайщик без допуска к проекту имущество предложить не может'), async () => {
    const outsider = await capitalMember('cpro')
    const hash = randomHash()
    const err = await gqlError(await tokenOf(outsider), CREATE, {
      d: { ...input(hash).d, username: outsider.account },
    })
    expect(err, 'отказ цепи: нет приложения к договору УХД по проекту').not.toBeNull()
    expect(await chainProperty(hash)).toBeUndefined()
  }, 300_000)
})
