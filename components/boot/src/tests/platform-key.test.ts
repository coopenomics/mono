/**
 * Контрактный уровень: ключ установки — разрешение platform (реестр system.platform-key).
 *
 * registrator::setplatform создаёт разрешение platform с родителем owner и ставит
 * active = {ключ пайщика, <аккаунт>@platform}. Узел кооператива подписывает как
 * active ключом platform; changekey при восстановлении доступа сохраняет
 * делегирование (по строке в registrator::platforms).
 *
 * Требует поднятого стенда с кооперативом voskhod. Ключ пайщика у действующего
 * пайщика не меняется: setplatform и changekey получают его нынешний ключ, вход
 * пайщика продолжает работать. Ключи узла и тестовые аккаунты новые на каждый
 * прогон — тест повторяем.
 */
import { describe, expect, it } from 'vitest'
import { RegistratorContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'

const COOP = 'voskhod'

const API_URL = process.env.API_URL || 'http://127.0.0.1:2998/v1/graphql'
const PLATFORM = RegistratorContract.Actions.SetPlatform.permissionName

const bc = new Blockchain(config.network, config.private_keys)
async function rpc() {
  await bc.update_pass_instance()
  return bc.api.rpc
}

async function generateKey(): Promise<{ wif: string, pub: string }> {
  const ecc = (await import('eosjs-ecc')).default ?? (await import('eosjs-ecc'))
  const wif: string = await ecc.randomKey()
  return { wif, pub: ecc.privateToPublic(wif) }
}

let txSeq = 0
async function transact(actions: any[], keys?: string[]) {
  await bc.update_pass_instance()
  txSeq = (txSeq + 1) % 600
  const opts = { blocksBehind: 3, expireSeconds: 30 + txSeq }
  if (!keys)
    return bc.api.transact({ actions }, opts)
  const { Api } = await import('eosjs')
  const { JsSignatureProvider } = await import('eosjs/dist/eosjs-jssig')
  const api = new Api({ rpc: await rpc(), signatureProvider: new JsSignatureProvider(keys), textEncoder: new TextEncoder(), textDecoder: new TextDecoder() as any })
  return api.transact({ actions }, opts)
}

const errorText = (e: any): string => e?.json?.error?.details?.[0]?.message ?? e?.message ?? String(e)
const AUTH_REFUSED = /does not have signatures|missing authority|unsatisfied|irrelevant authority|minimum authority/i

/**
 * Подпись принята цепью: транзакция прошла либо упала на проверке контракта,
 * которая идёт уже после проверки полномочий.
 */
async function expectAuthorized(run: () => Promise<unknown>) {
  try {
    await run()
  }
  catch (e) {
    expect(errorText(e)).not.toMatch(AUTH_REFUSED)
  }
}

async function expectRefused(run: () => Promise<unknown>, pattern: RegExp) {
  let message = ''
  try {
    await run()
  }
  catch (e) {
    message = errorText(e)
  }
  expect(message).toMatch(pattern)
}

async function permissions(account: string) {
  const acc = await (await rpc()).get_account(account)
  const of = (name: string) => acc.permissions.find((p: any) => p.perm_name === name)
  return { active: of('active'), platform: of(PLATFORM) }
}

function probe(account: string) {
  return {
    account: 'eosio',
    name: 'buyrambytes',
    authorization: [{ actor: account, permission: 'active' }],
    data: { payer: account, receiver: account, bytes: 100 + txSeq },
  }
}

async function newAccount(name: string, activeKey: string) {
  await transact([
    {
      account: 'eosio',
      name: 'newaccount',
      authorization: [{ actor: 'eosio', permission: 'active' }],
      data: {
        creator: 'eosio',
        name,
        owner: { threshold: 1, keys: [], accounts: [{ permission: { actor: 'registrator', permission: 'active' }, weight: 1 }], waits: [] },
        active: { threshold: 1, keys: [{ key: activeKey, weight: 1 }], accounts: [], waits: [] },
      },
    },
    { account: 'eosio', name: 'buyrambytes', authorization: [{ actor: 'eosio', permission: 'active' }], data: { payer: 'eosio', receiver: name, bytes: 16384 } },
  ])
}

function randomName(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz12345'
  let s = 'plt'
  while (s.length < 12) s += alphabet[Math.floor(Math.random() * alphabet.length)]
  return s
}

/** Мутация setWif без входа: право на запись даёт только сам ключ, сверка — с цепью. */
async function setWif(username: string, wif: string): Promise<{ ok: boolean, code?: string }> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'mutation($d:SetWifInput!){ setWif(data:$d) }',
      variables: { d: { username, wif, permission: 'active' } },
    }),
  })
  const body = await res.json() as any
  if (body.errors?.length)
    return { ok: false, code: body.errors[0]?.extensions?.code ?? body.errors[0]?.message }
  return { ok: body.data?.setWif === true }
}

async function memberOfCoop(): Promise<string> {
  const rows = (await (await rpc()).get_table_rows({ code: 'soviet', scope: COOP, table: 'participants', limit: 100, json: true })).rows
  const accepted = rows.filter((r: any) => r.status === 'accepted').map((r: any) => r.username)
  expect(accepted.length, 'в кооперативе есть действующий пайщик').toBeGreaterThan(0)
  return accepted[accepted.length - 1]
}

describe('ключ установки: registrator::setplatform', () => {
  it('sys.plat.happy.01 / happy.02: кооператив выпускает platform пайщику, changekey сохраняет делегирование', async () => {
    const member = await memberOfCoop()
    const userKey = String((await permissions(member)).active.required_auth.keys[0].key)
    const node = await generateKey()

    await transact([{
      account: RegistratorContract.contractName.production,
      name: RegistratorContract.Actions.SetPlatform.actionName,
      authorization: [{ actor: COOP, permission: 'active' }],
      data: { coopname: COOP, username: member, platform_key: node.pub, active_key: userKey },
    }])

    const after = await permissions(member)
    expect(after.platform.parent).toBe('owner')
    expect(after.active.required_auth.accounts.map((a: any) => `${a.permission.actor}@${a.permission.permission}`)).toEqual([`${member}@${PLATFORM}`])
    expect(after.active.required_auth.keys.map((k: any) => k.key)).toEqual([userKey])
    const row = await (await rpc()).get_table_rows({ code: 'registrator', scope: 'registrator', table: 'platforms', lower_bound: member, upper_bound: member, json: true })
    expect(row.rows[0]?.coopname).toBe(COOP)

    await expectAuthorized(() => transact([probe(member)], [node.wif]))

    // Восстановление доступа: тот же путь, что у ВОСХОДа, ключ пайщика прежний.
    await transact([{
      account: RegistratorContract.contractName.production,
      name: RegistratorContract.Actions.ChangeKey.actionName,
      authorization: [{ actor: COOP, permission: 'active' }],
      data: { coopname: COOP, changer: COOP, username: member, public_key: userKey },
    }])
    const rotated = await permissions(member)
    expect(rotated.active.required_auth.accounts.map((a: any) => a.permission.permission)).toEqual([PLATFORM])
    await expectAuthorized(() => transact([probe(member)], [node.wif]))
  })

  it('sys.plat.happy.03 / break.02: аккаунт выпускает platform себе сам; своим активным ключом его не сменить и не удалить', async () => {
    const name = randomName()
    const owner = await generateKey()
    const node = await generateKey()
    await newAccount(name, owner.pub)

    await transact([{
      account: RegistratorContract.contractName.production,
      name: RegistratorContract.Actions.SetPlatform.actionName,
      authorization: [{ actor: name, permission: 'active' }],
      data: { coopname: name, username: name, platform_key: node.pub, active_key: owner.pub },
    }], [owner.wif])

    await expectAuthorized(() => transact([probe(name)], [node.wif]))

    await expectRefused(() => transact([{
      account: 'eosio',
      name: 'updateauth',
      authorization: [{ actor: name, permission: 'active' }],
      data: { account: name, permission: PLATFORM, parent: 'owner', auth: { threshold: 1, keys: [{ key: owner.pub, weight: 1 }], accounts: [], waits: [] } },
    }], [owner.wif]), AUTH_REFUSED)
    await expectRefused(() => transact([{
      account: 'eosio',
      name: 'deleteauth',
      authorization: [{ actor: name, permission: 'active' }],
      data: { account: name, permission: PLATFORM },
    }], [owner.wif]), AUTH_REFUSED)
  })

  it('sys.plat.break.01: аккаунт не выпускает platform другому аккаунту', async () => {
    const member = await memberOfCoop()
    const before = await permissions(member)
    const name = randomName()
    const own = await generateKey()
    await newAccount(name, own.pub)

    await expectRefused(() => transact([{
      account: RegistratorContract.contractName.production,
      name: RegistratorContract.Actions.SetPlatform.actionName,
      authorization: [{ actor: name, permission: 'active' }],
      data: { coopname: name, username: member, platform_key: own.pub, active_key: own.pub },
    }], [own.wif]), /.+/)

    const after = await permissions(member)
    expect(after.active.required_auth).toEqual(before.active.required_auth)
  })

  it('sys.plat.happy.04: хранилище узла принимает ключ platform, посторонний ключ — нет', async () => {
    // Хранилище принимает только ключ своего кооператива, поэтому проверка — на
    // voskhod: новый ключ узла выпускается его же подписью, сохраняется через
    // setWif (он подписывает как active только через platform), в конце в
    // хранилище возвращается прежний ключ стенда — он стоит в active напрямую.
    const coopKey = config.private_keys[0]
    const active = (await permissions(COOP)).active
    const userKey = String(active.required_auth.keys[0].key)
    const node = await generateKey()
    await transact([{
      account: RegistratorContract.contractName.production,
      name: RegistratorContract.Actions.SetPlatform.actionName,
      authorization: [{ actor: COOP, permission: 'active' }],
      data: { coopname: COOP, username: COOP, platform_key: node.pub, active_key: userKey },
    }])

    try {
      expect(await setWif(COOP, node.wif)).toEqual({ ok: true })
      const stranger = await generateKey()
      expect((await setWif(COOP, stranger.wif)).code).toBe('AUTH_INVALID_PRIVATE_KEY')
    }
    finally {
      expect(await setWif(COOP, coopKey)).toEqual({ ok: true })
    }
  })

  it('sys.plat.happy.06: после старта узла у кооператива стенда выпущен platform, active делегирует на него', async () => {
    const { active, platform } = await permissions(COOP)
    expect(platform, 'разрешение platform выпущено').toBeTruthy()
    expect(platform.parent).toBe('owner')
    expect(active.required_auth.accounts.map((a: any) => `${a.permission.actor}@${a.permission.permission}`)).toContain(`${COOP}@${PLATFORM}`)
  })
})
