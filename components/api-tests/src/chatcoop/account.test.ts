/**
 * Учётная запись «Чата кооператива» (test-registry/chatcoop.account.yaml):
 * есть ли у пайщика привязанная запись сервера чата, как она заводится и как
 * находится по почте.
 *
 * Сервер чата на стенде играет подставной узел: набор задаёт его ответы и
 * читает, что платформа ему отправила. Пока ответы не заданы, сервер чата
 * для платформы недоступен — как при обрыве связи.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { admitCandidate, caseName, expectCode, freshMember, gql, gqlError, randomAccount, stubRequests, stubReset, stubRoute, tokenOf, waitFor } from '../core'
import { freshKeyPair, organizationData, registerInput } from '../platform/platform-b.helpers'

const STATUS = `query{ chatcoopGetAccountStatus{ hasAccount matrixUsername iframeUrl } }`
const CREATE = 'mutation($d:CreateMatrixAccountInputDTO!){ chatcoopCreateAccount(data:$d) }'
const AVAILABLE = 'query($d:CheckMatrixUsernameInput!){ chatcoopCheckUsernameAvailability(data:$d) }'

const LOGIN_PATH = '/_matrix/client/r0/login'
const USERS_PATH = '/_synapse/admin/v2/users/*'

/** Сервер чата впускает администратора платформы. */
async function chatServerUp(): Promise<void> {
  await stubRoute('POST', LOGIN_PATH, { body: { access_token: 'blackbox-admin-token', user_id: '@blackbox-admin:stub', device_id: 'BLACKBOX' } })
}

describe('chatcoop: учётная запись чата', () => {
  beforeAll(async () => {
    await stubReset()
  })

  afterAll(async () => {
    await stubReset()
  })

  it(caseName('chat.acc.happy.01', 'у нового пайщика учётной записи чата нет — статус без имени и адреса клиента'), async () => {
    const token = await tokenOf(freshMember({ prefix: 'chat' }))
    const d = await gql<any>(token, STATUS)
    expect(d.chatcoopGetAccountStatus).toEqual({ hasAccount: false, matrixUsername: null, iframeUrl: null })
  })

  it(caseName('chat.acc.side.01', 'гость не узнаёт статус учётной записи чата'), async () => {
    expect(String((await gqlError(null, STATUS))?.code)).toBe('401')
  })

  describe('сервер чата на связи', () => {
    let member: Who
    let token = ''
    let name = ''

    beforeAll(async () => {
      member = freshMember({ prefix: 'chta', firstName: 'Чат', lastName: 'Пайщиков' })
      token = await tokenOf(member)
      name = `bb${member.account}`
      await chatServerUp()
    }, 300_000)

    it(caseName('chat.acc.side.02', 'имя свободно, пока сервер чата его не знает; занятое имя — недоступно'), async () => {
      // Незнакомое имя сервер чата не находит — оно свободно.
      expect((await gql<any>(token, AVAILABLE, { d: { username: name } })).chatcoopCheckUsernameAvailability).toBe(true)

      await stubRoute('GET', USERS_PATH, { body: { name: '@taken:stub:8090' } })
      expect((await gql<any>(token, AVAILABLE, { d: { username: 'taken' } })).chatcoopCheckUsernameAvailability).toBe(false)
      await stubRoute('GET', USERS_PATH, { status: 404, body: { errcode: 'M_NOT_FOUND' } })
    })

    it(caseName('chat.acc.happy.02', 'пайщик заводит учётную запись чата — она привязана к нему, статус отдаёт имя и адрес клиента; повтор — отказ'), async () => {
      await stubRoute('PUT', USERS_PATH, { status: 201, body: { name: `@${name}:stub:8090` } })
      expect((await gql<any>(token, CREATE, { d: { username: name, password: 'Blackbox-пароль-1' } })).chatcoopCreateAccount).toBe(true)

      const sent = (await stubRequests(USERS_PATH)).filter(r => r.method === 'PUT').at(-1)!
      expect(decodeURIComponent(sent.path)).toContain(`@${name}:`)
      expect(sent.headers.authorization).toBe('Bearer blackbox-admin-token')
      expect(sent.body.threepids, 'почта пайщика привязана к записи').toEqual(expect.arrayContaining([{ medium: 'email', address: member.email }]))
      expect(String(sent.body.displayname)).toContain('Пайщиков')
      expect(sent.body.admin).toBe(false)

      const status = (await gql<any>(token, STATUS)).chatcoopGetAccountStatus
      expect(status.hasAccount).toBe(true)
      expect(status.matrixUsername).toBe(name)
      expect(status.iframeUrl, 'адрес клиента чата из настроек узла').toBeTruthy()

      expectCode(await gqlError(token, CREATE, { d: { username: `${name}2`, password: 'Blackbox-пароль-2' } }), 'CHATCOOP_MATRIX_ACCOUNT_ALREADY_EXISTS')
    })

    it(caseName('chat.acc.happy.03', 'у пайщика уже есть запись на сервере чата с той же почтой — статус привязывает её'), async () => {
      const veteran = freshMember({ prefix: 'chtv' })
      const veteranToken = await tokenOf(veteran)
      await stubRoute('GET', `/_synapse/admin/v1/threepid/email/users/${encodeURIComponent(veteran.email)}`, { body: { user_id: '@veteran:stub:8090' } })

      const first = (await gql<any>(veteranToken, STATUS)).chatcoopGetAccountStatus
      expect(first).toMatchObject({ hasAccount: true, matrixUsername: 'veteran' })

      // Привязка записана: второй запрос отвечает уже из реестра узла, сервер чата по почте не спрашивается.
      const asked = (await stubRequests('/_synapse/admin/v1/threepid/email/users/*')).length
      const second = (await gql<any>(veteranToken, STATUS)).chatcoopGetAccountStatus
      expect(second).toMatchObject({ hasAccount: true, matrixUsername: 'veteran' })
      expect((await stubRequests('/_synapse/admin/v1/threepid/email/users/*')).length).toBe(asked)
    }, 300_000)

    it(caseName('chat.acc.side.04', 'пайщик-кооператив получает общий чат с союзом: комната создана один раз, в ней он и представитель союза'), async () => {
      // Пайщик-организация типа «кооператив», заявленный формой вступления.
      const username = randomAccount('chco')
      const { publicKey } = await freshKeyPair()
      const reg = await gql<any>(null, 'mutation($d:RegisterAccountInput!){ registerAccount(data:$d){ tokens{ access{ token } } } }', {
        d: registerInput(username, publicKey, 'organization', organizationData({ short_name: `ПК «Сосед ${username}»` })),
      })
      const coopToken = reg.registerAccount.tokens.access.token as string
      // Чат открыт пайщикам: кандидата принимает совет (в цепи — registrator::adduser).
      await admitCandidate(username)
      const matrixName = `bb${username}`
      const room = `!union-${username}:stub:8090`
      await stubRoute('PUT', USERS_PATH, { status: 201, body: { name: `@${matrixName}:stub:8090` } })
      await stubRoute('POST', '/_matrix/client/v3/createRoom', { body: { room_id: room } })
      await stubRoute('POST', '/_synapse/admin/v1/join/*', { body: { room_id: room } })
      await stubRoute('PUT', '/_matrix/client/v3/rooms/*', { body: { event_id: '$blackbox-event' } })

      // Узел узнаёт о приёме из цепи — до этого чат отвечает «только для пайщиков».
      const opened = await waitFor(async () => {
        const r = await gqlError(coopToken, CREATE, { d: { username: matrixName, password: 'Blackbox-пароль-4' } })
        return r === null ? true : (String(r.code) === 'KIT_MEMBERS_ONLY' ? null : r)
      }, { timeoutMs: 60_000, intervalMs: 1_500, label: 'принятый пайщик-кооператив завёл учётную запись чата' })
      expect(opened, JSON.stringify(opened)).toBe(true)

      const created = await stubRequests('/_matrix/client/v3/createRoom')
      expect(created, 'комната с союзом создана').toHaveLength(1)
      expect(String(created[0].body.name)).toContain(`Сосед ${username}`)
      expect(created[0].body.preset).toBe('private_chat')
      const joined = (await stubRequests('/_synapse/admin/v1/join/*')).map(r => r.body.user_id)
      expect(joined).toEqual(expect.arrayContaining(['@union-person:stub:8090', `@${matrixName}:stub:8090`]))
      expect((await stubRequests('/_matrix/client/v3/rooms/*')).some(r => r.method === 'PUT'), 'приветствие отправлено').toBe(true)

      // Повторное открытие чата комнату второй раз не создаёт.
      const status = (await gql<any>(coopToken, STATUS)).chatcoopGetAccountStatus
      expect(status.hasAccount).toBe(true)
      expect(await stubRequests('/_matrix/client/v3/createRoom')).toHaveLength(1)
    }, 300_000)

    it(caseName('chat.acc.side.03', 'сервер чата отказал в регистрации — запись не заводится, статус «нет записи»'), async () => {
      const unlucky = freshMember({ prefix: 'chtu' })
      const unluckyToken = await tokenOf(unlucky)
      await stubRoute('PUT', USERS_PATH, { status: 500, body: { errcode: 'M_UNKNOWN' } })
      expectCode(await gqlError(unluckyToken, CREATE, { d: { username: `bb${unlucky.account}`, password: 'Blackbox-пароль-3' } }), 'CHATCOOP_MATRIX_ACCOUNT_CREATE_FAILED')
      expect((await gql<any>(unluckyToken, STATUS)).chatcoopGetAccountStatus.hasAccount).toBe(false)
    }, 300_000)
  })
})
