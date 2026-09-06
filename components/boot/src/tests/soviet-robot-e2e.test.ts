/**
 * Сквозной сценарий робота решений совета на стенде (реестр soviet.robot,
 * уровень backend): расширение установлено, три члена совета (включая
 * председателя) выпустили разрешения робота и передали ключи, свободное решение
 * опубликовано штатным путём — робот голосует за делегировавших первой
 * транзакцией, собирает протокол, подписывает его ключом председателя и второй
 * транзакцией утверждает и исполняет решение. Второй сценарий — режим «как
 * председатель»: робот молчит, пока председатель не проголосует, затем повторяет.
 *
 * Требует стенда после `reboot:extra` и работающего coopback с расширением
 * робота: API_URL указывает на его GraphQL (у mono-ai-3 — :3018).
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { SovietContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config, { private_key } from '../configs'
import { gqlAs, loginAs, signAs, type Who } from './marketplace/chainHelpers'
import { signVote } from './shared/signVote'

const COOP = 'voskhod'
const ROBOT_PERMISSION = 'robot'
const FREE = 'freedecision'
const bc = new Blockchain(config.network, config.private_keys)

// Совет стенда: у всех в active стоит ключ стенда (infra.ts changeKey)
const MEMBERS: Who[] = [
  { account: 'ant', email: 'ivanov@example.com', wif: private_key },
  { account: 'petr', email: 'sidorov@example.com', wif: private_key },
  { account: 'anna', email: 'petrova@example.com', wif: private_key },
]

const tokens: Record<string, string> = {}
let boardId = 0

async function transact(actions: any[]) {
  await bc.update_pass_instance()
  return bc.api.transact({ actions }, { blocksBehind: 3, expireSeconds: 30 })
}

async function generateKey(): Promise<{ wif: string, pub: string }> {
  const ecc = (await import('eosjs-ecc')).default ?? (await import('eosjs-ecc'))
  const wif: string = await ecc.randomKey()
  return { wif, pub: ecc.privateToPublic(wif) }
}

async function issueRobotPermission(account: string): Promise<string> {
  const key = await generateKey()
  await transact([{
    account: 'eosio',
    name: 'updateauth',
    authorization: [{ actor: account, permission: 'active' }],
    data: {
      account,
      permission: ROBOT_PERMISSION,
      parent: 'active',
      auth: { threshold: 1, keys: [{ key: key.pub, weight: 1 }], accounts: [], waits: [] },
    },
  }])
  try {
    await transact(SovietContract.robotLinkedActions.map(type => ({
      account: 'eosio',
      name: 'linkauth',
      authorization: [{ actor: account, permission: 'active' }],
      data: { account, code: SovietContract.contractName.production, type, requirement: ROBOT_PERMISSION },
    })))
  } catch (e: any) {
    if (!/same as old/.test(String(e?.message ?? e))) throw e
  }
  // ждём, пока узел отдаст свежее разрешение с этим ключом
  for (let i = 0; i < 20; i++) {
    const acc: any = await (await fetch(`${config.network.protocol}://${config.network.host}${config.network.port}/v1/chain/get_account`, {
      method: 'POST', body: JSON.stringify({ account_name: account }),
    })).json()
    const perm = (acc.permissions ?? []).find((p: any) => p.perm_name === ROBOT_PERMISSION)
    if (perm && perm.required_auth.keys.some((k: any) => k.key === key.pub)) break
    await new Promise(r => setTimeout(r, 500))
  }
  return key.wif
}

type FollowRule = SovietContract.Interfaces.IFollowRule

async function automate(member: string, vote_types: string[], authorize_types: string[], follow_rules: FollowRule[] = []) {
  await transact([{
    account: SovietContract.contractName.production,
    name: SovietContract.Actions.Decisions.Automate.actionName,
    authorization: [{ actor: member, permission: 'active' }],
    data: {
      coopname: COOP, board_id: boardId, member, permission_name: ROBOT_PERMISSION,
      vote_types, follow_rules, authorize_types, limit: '0.0000 RUB', expires_at: '1970-01-01T00:00:00',
    },
  }])
}

/** Свободное решение штатным путём: проект, заявление, публикация. Возвращает номер решения. */
async function publishFreeDecision(question: string): Promise<number> {
  const before = await maxDecisionId()
  const created: any = await gqlAs(tokens.ant, 'mutation($d:CreateProjectFreeDecisionInput!){ createProjectOfFreeDecision(data:$d){ id } }', {
    d: { question, decision: 'Считать проверку пройденной' },
  })
  const projectId = created.createProjectOfFreeDecision.id
  const generated: any = await gqlAs(tokens.ant, 'mutation($d:ProjectFreeDecisionGenerateDocumentInput!){ generateProjectOfFreeDecision(data:$d){ full_title html hash meta binary } }', {
    d: { coopname: COOP, project_id: projectId, username: 'ant' },
  })
  const signed = await signAs(private_key, generated.generateProjectOfFreeDecision, 'ant', 1)
  await gqlAs(tokens.ant, 'mutation($d:PublishProjectFreeDecisionInput!){ publishProjectOfFreeDecision(data:$d){ table { id } } }', {
    d: { coopname: COOP, username: 'ant', meta: '', document: signed },
  })
  const decisionId = await maxDecisionId()
  expect(decisionId, 'повестка появилась в цепи').toBeGreaterThan(before)
  return decisionId
}

/** Ждём, пока журнал робота доведёт решение до конечного этапа (или до заданного). */
async function waitJournal(decisionId: number, until: (stage: string) => boolean, ms: number) {
  const started = Date.now()
  let entry: any = null
  while (Date.now() - started < ms) {
    const journal: any = await gqlAs(tokens.petr, 'query($o:PaginationInput){ sovietRobotJournal(options:$o){ items { decision_id decision_type stage waiting_for votes { member permission } tx_hashes last_error attempts } } }', {
      o: { page: 1, limit: 50, sortBy: 'decision_id', sortOrder: 'DESC' },
    })
    entry = journal.sovietRobotJournal.items.find((i: any) => Number(i.decision_id) === decisionId) ?? null
    if (entry && until(String(entry.stage).toLowerCase())) break
    await new Promise(r => setTimeout(r, 3000))
  }
  return entry
}

async function decisionRow(id: number) {
  const rows: any[] = await bc.getTableRows(SovietContract.contractName.production, COOP, 'decisions', 200)
  return rows.find(r => Number(r.id) === id)
}

async function maxDecisionId(): Promise<number> {
  const rows: any[] = await bc.getTableRows(SovietContract.contractName.production, COOP, 'decisions', 200)
  return rows.length ? Math.max(...rows.map(r => Number(r.id))) : 0
}

describe('робот решений совета: сквозной сценарий на стенде', () => {
  beforeAll(async () => {
    await bc.update_pass_instance()
    const boards: any[] = await bc.getTableRows(SovietContract.contractName.production, COOP, 'boards', 10)
    boardId = Number(boards.find(b => b.type === 'soviet').id)
    for (const who of MEMBERS) tokens[who.account] = await loginAs(who)
  })

  it('расширение «Робот совета» установлено и включено', async () => {
    const installed = await gqlAs(tokens.ant, 'mutation($d:ExtensionInput!){ installExtension(data:$d){ name enabled } }', {
      d: { name: 'robot', enabled: true, config: {} },
    }).catch(() => null)
    if (!installed) {
      const updated: any = await gqlAs(tokens.ant, 'mutation($d:ExtensionInput!){ updateExtension(data:$d){ name enabled } }', {
        d: { name: 'robot', enabled: true, config: {} },
      })
      expect(updated.updateExtension.enabled).toBe(true)
    } else {
      expect(installed.installExtension.enabled).toBe(true)
    }
  })

  it('члены совета делегируют голос, председатель — протокол, ключи приняты роботом', async () => {
    for (const who of MEMBERS) {
      const wif = await issueRobotPermission(who.account)
      await automate(who.account, [FREE], who.account === 'ant' ? [FREE] : [])
      const res: any = await gqlAs(tokens[who.account], 'mutation($d:RobotDelegateKeyInput!){ sovietRobotDelegateKey(data:$d){ member has_key chain_has_permission chain_key_matches permission_name } }', {
        d: { wif },
      })
      expect(res.sovietRobotDelegateKey, `ключ ${who.account}`).toMatchObject({ member: who.account, has_key: true, chain_has_permission: true, chain_key_matches: true })
    }

    const reg: any = await gqlAs(tokens.petr, 'query{ sovietRobotRegistry{ type serviceable vote_quorum{ delegated_count required_count reached } chairman{ username delegated has_key } my_vote } }')
    const free = reg.sovietRobotRegistry.find((r: any) => r.type === FREE)
    expect(free.serviceable).toBe(true)
    expect(free.vote_quorum).toMatchObject({ delegated_count: 3, required_count: 3, reached: true })
    expect(free.chairman).toMatchObject({ username: 'ant', delegated: true, has_key: true })
    expect(free.my_vote).toBe(true)
  })

  it('режим «сразу»: свободное решение доводится роботом до исполнения двумя транзакциями', async () => {
    const decisionId = await publishFreeDecision('Проверка робота совета: режим «сразу»')
    const entry = await waitJournal(decisionId, s => ['executed', 'failed', 'closed'].includes(s), 150_000)

    expect(entry, 'робот увидел повестку').toBeTruthy()
    // GraphQL отдаёт имя перечисления в верхнем регистре
    expect(String(entry.stage).toLowerCase(), `этап решения (${entry?.last_error ?? ''})`).toBe('executed')
    expect(entry.votes.map((v: any) => v.member).sort()).toEqual(['anna', 'ant', 'petr'])
    expect(entry.votes.every((v: any) => v.permission === ROBOT_PERMISSION)).toBe(true)
    expect(entry.tx_hashes.length, 'голоса и протокол — две транзакции').toBe(2)
    expect(await decisionRow(decisionId), 'решение снято с повестки после исполнения').toBeUndefined()
  }, 200_000)

  it('режим «как председатель»: робот молчит до голоса председателя, затем повторяет и исполняет', async () => {
    // Пётр и Анна повторяют за председателем; председатель голосует сам, протокол — робот.
    await automate('petr', [], [], [{ decision_type: FREE, follow: 'ant' }])
    await automate('anna', [], [], [{ decision_type: FREE, follow: 'ant' }])
    await automate('ant', [], [FREE])

    const reg: any = await gqlAs(tokens.petr, 'query{ sovietRobotRegistry{ type vote_quorum{ delegated_count follow_groups{ follow count } reached reachable } warnings my_mode my_follow } }')
    const free = reg.sovietRobotRegistry.find((r: any) => r.type === FREE)
    expect(free.vote_quorum).toMatchObject({ delegated_count: 0, follow_groups: [{ follow: 'ant', count: 2 }], reached: false, reachable: true })
    expect(String(free.my_mode).toLowerCase()).toBe('follow')
    expect(free.my_follow).toBe('ant')
    expect(free.warnings).toEqual([])

    const decisionId = await publishFreeDecision('Проверка робота совета: режим «как председатель»')
    const waiting = await waitJournal(decisionId, s => s === 'awaiting_followed', 60_000)
    expect(waiting, 'робот ждёт голоса председателя').toBeTruthy()
    expect(String(waiting.stage).toLowerCase()).toBe('awaiting_followed')
    expect(waiting.waiting_for).toEqual(['ant'])
    expect(waiting.votes).toEqual([])

    // Председатель голосует «за» вручную, ключом active.
    await transact([{
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Decisions.VoteFor.actionName,
      authorization: [{ actor: 'ant', permission: 'active' }],
      data: await signVote(COOP, 'ant', decisionId),
    }])

    const entry = await waitJournal(decisionId, s => ['executed', 'failed', 'closed'].includes(s), 150_000)
    expect(String(entry.stage).toLowerCase(), `этап решения (${entry?.last_error ?? ''})`).toBe('executed')
    expect(entry.votes.map((v: any) => v.member).sort()).toEqual(['anna', 'petr'])
    expect(entry.tx_hashes.length, 'голоса повторяющих и протокол — две транзакции').toBe(2)
    expect(await decisionRow(decisionId), 'решение снято с повестки после исполнения').toBeUndefined()
  }, 260_000)
})
