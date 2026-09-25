/**
 * CoopID: сброс приложения-аутентификатора председателем
 * (test-registry/coopid.two-factor-reset.yaml).
 *
 * Пайщик потерял телефон — председатель снимает приложение без кода, и вместе
 * с ним гасится настройка «код из приложения при входе». Пайщик свежий: он
 * ставит пароль (факторы входа — надстройка над паролем), подключает
 * приложение сам через API кодом RFC 6238 от выданного секрета, и подключение
 * сразу включает код при входе.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COUNCIL, ROLES, caseName, expectAuthDenied, freshMember, gql, gqlRaw, login, tokenOf, totp, type Who } from '../core'
import { LOGIN_FACTORS, PARTICIPANT_LOGIN_SECURITY, RESET_TWO_FACTOR, enrollTotp, setPassword } from './coopid-a.helpers'

const DISABLE_TWO_FACTOR = 'mutation($d:TwoFactorCodeInput!){ disableTwoFactor(data:$d) }'

describe('coopid.two-factor-reset: председатель снимает приложение-аутентификатор', () => {
  let chairmanToken = ''
  let who: Who
  let memberToken = ''
  let secret = ''

  beforeAll(async () => {
    chairmanToken = await tokenOf(CHAIRMAN)
    who = freshMember({ prefix: 'c2f' })
    // Вход подписью — до пароля: после него пайщик входит только новым контуром.
    memberToken = await login(who)
    const migrated = await setPassword(who)
    // Пароль уходит в провайдер входа уже после записи блоба; для факторов входа
    // важен именно блоб, поэтому ответ провайдера здесь не решает — решает
    // состояние факторов, которое тест проверяет первым делом.
    if (!migrated.ok)
      console.warn(`coop/migration ${who.account}: ${migrated.status} ${(await migrated.text()).slice(0, 300)}`)
    secret = await enrollTotp(memberToken)
  })

  it(caseName('cid.2fr.happy.01', 'подключённое приложение видно председателю, сброс снимает секрет без кода'), async () => {
    const own = (await gql<any>(memberToken, LOGIN_FACTORS)).getLoginFactors
    expect(own, 'подключение приложения включило код при входе').toEqual({ totp_enrolled: true, totp_enabled: true })
    const seen = (await gql<any>(chairmanToken, PARTICIPANT_LOGIN_SECURITY, { d: { username: who.account } })).getParticipantLoginSecurity
    expect(seen).toEqual({ totp_enrolled: true, totp_enabled: true })

    const reset = await gql<any>(chairmanToken, RESET_TWO_FACTOR, { d: { username: who.account } })
    expect(reset.resetParticipantTwoFactor).toBe(true)

    expect((await gql<any>(memberToken, LOGIN_FACTORS)).getLoginFactors.totp_enrolled).toBe(false)
    // Секрета больше нет: код от прежнего приложения ничего не отключает.
    const stale = await gqlRaw(memberToken, DISABLE_TWO_FACTOR, { d: { code: totp(secret) } })
    expect(stale.data).toBeNull()
    expect(stale.errors.length).toBeGreaterThan(0)
  })

  it(caseName('cid.2fr.happy.02', 'сброс по учётному имени гасит настройку «код при входе»'), async () => {
    const seen = (await gql<any>(chairmanToken, PARTICIPANT_LOGIN_SECURITY, { d: { username: who.account } })).getParticipantLoginSecurity
    expect(seen).toEqual({ totp_enrolled: false, totp_enabled: false })
    const own = (await gql<any>(memberToken, LOGIN_FACTORS)).getLoginFactors
    expect(own).toEqual({ totp_enrolled: false, totp_enabled: false })
  })

  it(caseName('cid.2fr.side.01', 'у пайщика без приложения сброс возвращает false и ничего не меняет'), async () => {
    const reset = await gql<any>(chairmanToken, RESET_TWO_FACTOR, { d: { username: who.account } })
    expect(reset.resetParticipantTwoFactor).toBe(false)
    expect((await gql<any>(memberToken, LOGIN_FACTORS)).getLoginFactors).toEqual({ totp_enrolled: false, totp_enabled: false })

    const plain = freshMember({ prefix: 'c2n' })
    const resetPlain = await gql<any>(chairmanToken, RESET_TWO_FACTOR, { d: { username: plain.account } })
    expect(resetPlain.resetParticipantTwoFactor).toBe(false)
    const plainSeen = (await gql<any>(chairmanToken, PARTICIPANT_LOGIN_SECURITY, { d: { username: plain.account } })).getParticipantLoginSecurity
    expect(plainSeen).toEqual({ totp_enrolled: false, totp_enabled: false })
  })

  it(caseName('cid.2fr.break.01', 'пайщик, член совета и председатель участка не сбрасывают чужое приложение; себе — тоже нет'), async () => {
    const target = freshMember({ prefix: 'c2b' })
    const targetToken = await login(target)
    await enrollTotp(targetToken)

    for (const actor of [ROLES.member(), COUNCIL, ROLES.branchChairman()]) {
      const r = await gqlRaw(await tokenOf(actor), RESET_TWO_FACTOR, { d: { username: target.account } })
      expect(r.data, actor.account).toBeNull()
      expect(r.errors[0]?.code, actor.account).toBe('KIT_INSUFFICIENT_RIGHTS')
    }
    // Сам себе пайщик приложение этим входом не снимает: для него есть
    // disableTwoFactor с кодом.
    const self = await gqlRaw(targetToken, RESET_TWO_FACTOR, { d: { username: target.account } })
    expect(self.errors[0]?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
    const guest = await gqlRaw(null, RESET_TWO_FACTOR, { d: { username: target.account } })
    expect(guest.data).toBeNull()
    expectAuthDenied(guest.errors[0] ?? null)

    expect((await gql<any>(targetToken, LOGIN_FACTORS)).getLoginFactors.totp_enrolled).toBe(true)
  })
})
