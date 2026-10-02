/**
 * CoopID: критические действия совета и отзыв ключа пайщика
 * (test-registry/coopid.critical-actions.yaml).
 *
 * Критическое действие (исключение пайщика, смена ролей совета,
 * принудительное восстановление доступа) начинает председатель, а
 * подтверждает другой член совета: одним лицом оно не проводится. Всё, что
 * делали с пайщиком, остаётся в следе для контролирующего органа. Ключ
 * пайщика председатель отзывает сам — с обоснованием.
 *
 * Мир теста: свежий пайщик — цель действий; сами действия последствий в цепи
 * не имеют.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COUNCIL, COUNCIL_2, ROLES, caseName, expectAuthDenied, expectCode, freshMember, gql, gqlError, tokenOf } from '../core'

const PENDING = 'id action_type target_id actor_id status created_at expires_at finalized_at confirmations{ by at }'
const INITIATE = `mutation($d:InitiateCriticalActionInput!){ initiateCriticalAction(data:$d){ ${PENDING} } }`
const CONFIRM = `mutation($id:String!){ confirmCriticalAction(id:$id){ ${PENDING} } }`
const TRAIL = 'query($t:String!){ getCriticalActionAuditTrail(target_id:$t){ id action_type target_id status created_at finalized_at initiator_id initiated_at payload_hash confirmer_ids{ by at } } }'
const REVOKE_KEY = 'mutation($d:RevokeParticipantKeyInput!){ revokeParticipantKey(data:$d){ status target_id sessions_revoked must_recover } }'

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'
const DAY_MS = 24 * 3600_000

let chairman = ''
let council = ''
let council2 = ''
let member = ''
let target: Who
let action: any

/** Отказ гварда прав CoopID приходит кодом 403 без доменного имени. */
function denied(err: { code: string | null } | null): void {
  expect(err, 'ожидался отказ по правам').not.toBeNull()
  expect(['403', 'FORBIDDEN', 'KIT_INSUFFICIENT_RIGHTS']).toContain(String(err!.code))
}

async function trail(token = council): Promise<any[]> {
  return (await gql<any>(token, TRAIL, { t: target.account })).getCriticalActionAuditTrail
}

beforeAll(async () => {
  chairman = await tokenOf(CHAIRMAN)
  council = await tokenOf(COUNCIL)
  council2 = await tokenOf(COUNCIL_2)
  member = await tokenOf(ROLES.member())
  target = freshMember({ prefix: 'crit' })
}, 300_000)

describe('CoopID — критические действия совета', () => {
  it(caseName('coopid.crit.happy.01', 'председатель начинает критическое действие — оно ждёт второго лица, окно подтверждения сутки'), async () => {
    const startedAt = Date.now()
    action = (await gql<any>(chairman, INITIATE, {
      d: { action_type: 'ExcludeParticipant', target_id: target.account, payload: { reason: 'проверка внешнего слоя' } },
    })).initiateCriticalAction
    expect(action).toMatchObject({ action_type: 'ExcludeParticipant', target_id: target.account, actor_id: CHAIRMAN.account, status: 'Pending', finalized_at: null })
    expect(action.confirmations.map((c: any) => c.by), 'первая подпись — начавшего').toEqual([CHAIRMAN.account])
    const window = new Date(action.expires_at).getTime() - startedAt
    expect(window).toBeGreaterThan(DAY_MS - 60_000)
    expect(window).toBeLessThan(DAY_MS + 60_000)

    const entry = (await trail()).find(e => e.id === action.id)
    expect(entry).toMatchObject({ status: 'Pending', initiator_id: CHAIRMAN.account, finalized_at: null })
  })

  it(caseName('coopid.crit.side.01', 'начавший сам своё действие не подтверждает'), async () => {
    expectCode(await gqlError(chairman, CONFIRM, { id: action.id }), 'AUTH_V2_CRITICAL_ACTION_SELF_CONFIRM_FORBIDDEN')
    expect((await trail()).find(e => e.id === action.id).status).toBe('Pending')
  })

  it(caseName('coopid.crit.happy.02', 'другой член совета подтверждает — действие проведено, в следе оба лица'), async () => {
    const confirmed = (await gql<any>(council, CONFIRM, { id: action.id })).confirmCriticalAction
    expect(confirmed.status).toBe('Confirmed')
    expect(confirmed.finalized_at).toBeTruthy()
    expect(confirmed.confirmations.map((c: any) => c.by)).toEqual([CHAIRMAN.account, COUNCIL.account])

    const entry = (await trail(council2)).find(e => e.id === action.id)
    expect(entry).toMatchObject({ action_type: 'ExcludeParticipant', target_id: target.account, status: 'Confirmed', initiator_id: CHAIRMAN.account })
    expect(entry.confirmer_ids.map((c: any) => c.by)).toContain(COUNCIL.account)
    expect(entry.payload_hash, 'содержание действия зафиксировано хешем').toBeTruthy()
    expect(entry.finalized_at).toBeTruthy()
  })

  it(caseName('coopid.crit.side.02', 'проведённое действие повторно не подтверждается; действия, которого нет, — «не найдено»'), async () => {
    expectCode(await gqlError(council2, CONFIRM, { id: action.id }), 'AUTH_V2_CRITICAL_ACTION_NOT_PENDING')
    expectCode(await gqlError(council, CONFIRM, { id: UNKNOWN_ID }), 'AUTH_V2_CRITICAL_ACTION_NOT_FOUND')
  })

  it(caseName('coopid.crit.side.03', 'начинает действие только председатель; пайщик не начинает, не подтверждает и следа не читает'), async () => {
    const input = { d: { action_type: 'ChangeCouncilRoles', target_id: target.account } }
    denied(await gqlError(council, INITIATE, input))
    denied(await gqlError(member, INITIATE, input))
    expectAuthDenied(await gqlError(null, INITIATE, input))

    const pending = (await gql<any>(chairman, INITIATE, input)).initiateCriticalAction
    denied(await gqlError(member, CONFIRM, { id: pending.id }))
    denied(await gqlError(member, TRAIL, { t: target.account }))
    expect((await trail()).find(e => e.id === pending.id).status, 'чужие запросы действие не тронули').toBe('Pending')
  })
})

describe('CoopID — отзыв ключа пайщика', () => {
  it(caseName('coopid.revoke.happy.01', 'председатель отзывает ключ с обоснованием — пайщик обязан восстановить доступ'), async () => {
    const result = (await gql<any>(chairman, REVOKE_KEY, { d: { target_id: target.account, reason: 'ключ попал к постороннему' } })).revokeParticipantKey
    expect(result).toMatchObject({ status: 'revoked', target_id: target.account, must_recover: true })
    expect(result.sessions_revoked).toBeGreaterThanOrEqual(0)
  })

  it(caseName('coopid.revoke.side.01', 'ключ отзывает только председатель — члену совета и пайщику отказ'), async () => {
    const input = { d: { target_id: target.account, reason: 'чужой запрос' } }
    denied(await gqlError(council, REVOKE_KEY, input))
    denied(await gqlError(member, REVOKE_KEY, input))
    expectAuthDenied(await gqlError(null, REVOKE_KEY, input))
  })
})
