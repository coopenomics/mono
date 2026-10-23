/**
 * CoopID: отзыв ключа пайщика (test-registry/coopid.key-revocation.yaml).
 *
 * Ключ пайщика председатель отзывает сам, с обоснованием: сессии пайщика
 * закрываются, вход отозванным ключом закрыт, пока пайщик не сменит ключ.
 *
 * Мир теста: свежий пайщик, чей ключ отзывают.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COUNCIL, ROLES, caseName, expectAuthDenied, expectCode, freshMember, gql, gqlError, latestMail, login, tokenOf } from '../core'
import { freshKeyPair } from '../platform/platform-b.helpers'

const REVOKE_KEY = 'mutation($d:RevokeParticipantKeyInput!){ revokeParticipantKey(data:$d){ status target_id sessions_revoked must_recover } }'

let chairman = ''
let council = ''
let member = ''
let target: Who

/** Отказ гварда прав CoopID приходит кодом 403 без доменного имени. */
function denied(err: { code: string | null } | null): void {
  expect(err, 'ожидался отказ по правам').not.toBeNull()
  expect(['403', 'FORBIDDEN', 'KIT_INSUFFICIENT_RIGHTS']).toContain(String(err!.code))
}

beforeAll(async () => {
  chairman = await tokenOf(CHAIRMAN)
  council = await tokenOf(COUNCIL)
  member = await tokenOf(ROLES.member())
  target = freshMember({ prefix: 'rvk' })
}, 300_000)

describe('CoopID — отзыв ключа пайщика', () => {
  it(caseName('coopid.revoke.happy.01', 'председатель отзывает ключ с обоснованием — пайщик обязан восстановить доступ'), async () => {
    const result = (await gql<any>(chairman, REVOKE_KEY, { d: { target_id: target.account, reason: 'ключ попал к постороннему' } })).revokeParticipantKey
    expect(result).toMatchObject({ status: 'Revoked', target_id: target.account, must_recover: true })
    expect(result.sessions_revoked).toBeGreaterThanOrEqual(0)
  })

  it(caseName('coopid.revoke.side.02', 'отозванным ключом войти нельзя; после смены ключа вход новым ключом открыт, прежний не подходит'), async () => {
    // До 02.10.2026 отзыв только закрывал сессии: тем же ключом открывалась новая (C28-85, находка 61).
    const refusal = async (who: Who) => login(who).then(() => null, (e: any) => e?.errors?.[0] ?? { code: String(e?.message) })
    expectCode(await refusal(target), 'AUTH_KEY_REVOKED_RECOVERY_REQUIRED')

    // Восстановление доступа: письмо со ссылкой сброса ключа, новый ключ пайщика.
    await gql(null, 'mutation($d:StartResetKeyInput!){ startResetKey(data:$d) }', { d: { email: target.email } })
    const mail = await latestMail(target.email, 'reset-key?token=', 120_000)
    const token = /reset-key\?token=([^"'&\s<]+)/.exec(`${mail.html} ${mail.text}`)?.[1]
    expect(token, 'в письме ссылка сброса ключа').toBeTruthy()
    const fresh = await freshKeyPair()
    await gql(null, 'mutation($d:ResetKeyInput!){ resetKey(data:$d) }', { d: { token: decodeURIComponent(token!), public_key: fresh.publicKey } })

    expect(await login({ ...target, wif: fresh.wif }), 'новым ключом вход открыт').toBeTruthy()
    expect(await refusal(target), 'прежний ключ после смены не подходит').not.toBeNull()
  }, 300_000)

  it(caseName('coopid.revoke.side.01', 'ключ отзывает только председатель — члену совета и пайщику отказ'), async () => {
    const input = { d: { target_id: target.account, reason: 'чужой запрос' } }
    denied(await gqlError(council, REVOKE_KEY, input))
    denied(await gqlError(member, REVOKE_KEY, input))
    expectAuthDenied(await gqlError(null, REVOKE_KEY, input))
  })
})
