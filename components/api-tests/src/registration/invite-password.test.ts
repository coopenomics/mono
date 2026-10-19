/**
 * Приглашение пайщика ведёт на установку пароля (registration.invite-password).
 *
 * Председатель добавляет пайщика, тому уходит письмо со ссылкой приглашения.
 * Страница по токену из ссылки узнаёт почту приглашённого, ставит новый ключ и
 * задаёт пароль — ключ создаётся в браузере и на экран не выводится. Здесь те
 * же шаги идут через API: почта по токену, смена ключа, установка пароля.
 * После смены ключа ссылка приглашения гаснет.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, caseName, expectCode, gql, gqlError, latestMail, randomAccount, tokenOf } from '../core'
import { freshKeyPair } from '../platform/platform-b.helpers'
import { setPassword } from '../coopid/coopid-a.helpers'

const ADD = `mutation($d:AddParticipantInput!){ addParticipant(data:$d){ username } }`
const RECIPIENT = `query($d:InviteRecipientInput!){ inviteRecipient(data:$d){ email } }`
const RESET = `mutation($d:ResetKeyInput!){ resetKey(data:$d) }`

describe('приглашение пайщика — пароль вместо ключа', () => {
  let chairman: string

  beforeAll(async () => {
    chairman = await tokenOf(CHAIRMAN)
  }, 120_000)

  it(caseName('reg.invite.break.01', 'чужой токен — отказ с кодом, почта не раскрывается'), async () => {
    expectCode(await gqlError(null, RECIPIENT, { d: { token: 'not-a-token' } }), 'AUTH_INVITE_TOKEN_INVALID')
  })

  it(caseName('reg.invite.happy.01', 'по ссылке из письма: почта приглашённого, новый ключ, пароль; ссылка после этого гаснет'), async () => {
    const email = `${randomAccount('inv')}@api-tests.coop`
    const added = (await gql<any>(chairman, ADD, {
      d: {
        email,
        type: 'individual',
        created_at: new Date().toISOString().slice(0, 19),
        initial: '0.0000 RUB',
        minimum: '0.0000 RUB',
        spread_initial: false,
        individual_data: {
          first_name: 'Тест',
          last_name: 'Приглашённый',
          middle_name: 'Проверочный',
          birthdate: '1990-01-01',
          phone: '+70000000000',
          full_address: 'г. Москва, ул. Тестовая, 1',
          email,
        },
      },
    })).addParticipant

    const mail = await latestMail(email, 'auth/invite?token=', 120_000)
    const raw = /auth\/invite\?token=([^"'&\s<]+)/.exec(`${mail.html} ${mail.text}`)?.[1]
    expect(raw, 'в письме ссылка приглашения').toBeTruthy()
    const token = decodeURIComponent(raw!)

    // Токен на чтение почты не расходуется: спросить можно и дважды.
    expect((await gql<any>(null, RECIPIENT, { d: { token } })).inviteRecipient).toEqual({ email })
    expect((await gql<any>(null, RECIPIENT, { d: { token } })).inviteRecipient).toEqual({ email })

    const fresh = await freshKeyPair()
    expect((await gql<any>(null, RESET, { d: { token, public_key: fresh.publicKey } })).resetKey).toBe(true)

    const res = await setPassword({ account: added.username, email, wif: fresh.wif } as any)
    expect(res.ok, `установка пароля: ${res.status}`).toBe(true)

    // Ссылка приглашения погашена: ни почты по ней, ни повторной смены ключа.
    expectCode(await gqlError(null, RECIPIENT, { d: { token } }), 'AUTH_INVITE_TOKEN_INVALID')
    expectCode(await gqlError(null, RESET, { d: { token, public_key: (await freshKeyPair()).publicKey } }), 'AUTH_KEY_RESET_ERROR')
  }, 300_000)
})
