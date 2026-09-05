/**
 * Контрактный уровень: робот решений совета (реестр soviet.robot).
 *
 * Член совета заводит отдельное разрешение аккаунта с ключом робота и делегирует
 * роботу голосование по типам решений; председатель — подпись протоколов. Контракт
 * soviet привязывает хэш голоса к решению и проверяет интринзиком
 * assert_recover_key_account, что ключ подписи принадлежит заявленному разрешению
 * аккаунта, а для разрешения робота — что тип решения делегирован.
 *
 * Требует стенда после `reboot:extra`: совет из пяти человек (ant — председатель,
 * petr, anna, mikhail, olga), у всех в active стоит ключ стенда. Ключи робота
 * генерируются на каждый прогон, поэтому тест повторяем неограниченно.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { SovietContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { signVote } from './shared/signVote'
import { signProtocol } from './shared/signProtocol'

const COOP = 'voskhod'
const CHAIRMAN = 'ant'
const ROBOT_PERMISSION = 'robot'
const FREE = 'freedecision'

const bc = new Blockchain(config.network, config.private_keys)

let boardId = 0
const robotKeys: Record<string, { wif: string, pub: string }> = {}

async function generateKey(): Promise<{ wif: string, pub: string }> {
  const ecc = (await import('eosjs-ecc')).default ?? (await import('eosjs-ecc'))
  const wif: string = await ecc.randomKey()
  return { wif, pub: ecc.privateToPublic(wif) }
}

async function transact(actions: any[]) {
  await bc.update_pass_instance()
  return bc.api.transact({ actions }, { blocksBehind: 3, expireSeconds: 30 })
}

/** Разрешение робота на аккаунте члена совета + привязка к голосованию. */
async function issueRobotPermission(account: string) {
  const key = await generateKey()
  robotKeys[account] = key
  await transact([
    {
      account: 'eosio',
      name: 'updateauth',
      authorization: [{ actor: account, permission: 'active' }],
      data: {
        account,
        permission: ROBOT_PERMISSION,
        parent: 'active',
        auth: { threshold: 1, keys: [{ key: key.pub, weight: 1 }], accounts: [], waits: [] },
      },
    },
    {
      account: 'eosio',
      name: 'linkauth',
      authorization: [{ actor: account, permission: 'active' }],
      data: { account, code: SovietContract.contractName.production, type: 'votefor', requirement: ROBOT_PERMISSION },
    },
  ])
  return key
}

function automateAction(member: string, vote_types: string[], authorize_types: string[], permission_name = ROBOT_PERMISSION) {
  return {
    account: SovietContract.contractName.production,
    name: SovietContract.Actions.Decisions.Automate.actionName,
    authorization: [{ actor: member, permission: 'active' }],
    data: {
      coopname: COOP,
      board_id: boardId,
      member,
      permission_name,
      vote_types,
      authorize_types,
      limit: '0.0000 RUB',
      expires_at: '1970-01-01T00:00:00',
    } satisfies SovietContract.Actions.Decisions.Automate.IAutomate,
  }
}

async function disautomate(member: string) {
  await transact([{
    account: SovietContract.contractName.production,
    name: SovietContract.Actions.Decisions.Disautomate.actionName,
    authorization: [{ actor: member, permission: 'active' }],
    data: { coopname: COOP, board_id: boardId, member } satisfies SovietContract.Actions.Decisions.Disautomate.IDisautomate,
  }])
}

async function automatorRow(member: string) {
  const rows: any[] = await bc.getTableRows(SovietContract.contractName.production, COOP, 'automator', 100)
  return rows.find(r => r.member === member)
}

async function decisionRow(id: number) {
  const rows: any[] = await bc.getTableRows(SovietContract.contractName.production, COOP, 'decisions', 200)
  return rows.find(r => Number(r.id) === id)
}

/** Свободное решение от председателя; номер берём из события newsubmitted в трассе. */
async function newFreeDecision(): Promise<{ id: number, submittedId: number }> {
  const statement = await signProtocol(CHAIRMAN, `stmt-${Date.now()}`)
  const result: any = await transact([{
    account: SovietContract.contractName.production,
    name: 'freedecision',
    authorization: [{ actor: CHAIRMAN, permission: 'active' }],
    data: { coopname: COOP, username: CHAIRMAN, document: statement, meta: '{}' },
  }])
  const traces: any[] = []
  const walk = (t: any) => { traces.push(t); (t.inline_traces || []).forEach(walk) }
  result.processed.action_traces.forEach(walk)
  const submitted = traces.find(t => t.act?.name === 'newsubmitted' && t.receiver === SovietContract.contractName.production)
  expect(submitted, 'повестка эмитит newsubmitted').toBeTruthy()
  const submittedId = Number(submitted.act.data.decision_id)
  const rows: any[] = await bc.getTableRows(SovietContract.contractName.production, COOP, 'decisions', 200)
  const id = Math.max(...rows.map(r => Number(r.id)))
  return { id, submittedId }
}

/** Голос от имени члена совета: транзакцию подаёт кооператив, подпись — переданным ключом. */
function voteAsCoop(voteData: SovietContract.Actions.Decisions.VoteFor.IVoteForDecision) {
  return transact([{
    account: SovietContract.contractName.production,
    name: SovietContract.Actions.Decisions.VoteFor.actionName,
    authorization: [{ actor: COOP, permission: 'active' }],
    data: voteData,
  }])
}

function voteAsMember(voteData: SovietContract.Actions.Decisions.VoteFor.IVoteForDecision) {
  return transact([{
    account: SovietContract.contractName.production,
    name: SovietContract.Actions.Decisions.VoteFor.actionName,
    authorization: [{ actor: voteData.username, permission: 'active' }],
    data: voteData,
  }])
}

function authorizeAndExec(decision_id: number, document: any, permission: string) {
  const authData: SovietContract.Actions.Decisions.Authorize.IAuthorize = {
    coopname: COOP, chairman: CHAIRMAN, decision_id, document, permission,
  }
  const execData: SovietContract.Actions.Decisions.Exec.IExec = { executer: CHAIRMAN, coopname: COOP, decision_id }
  return transact([
    {
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Decisions.Authorize.actionName,
      authorization: [{ actor: COOP, permission: 'active' }],
      data: authData,
    },
    {
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Decisions.Exec.actionName,
      authorization: [{ actor: COOP, permission: 'active' }],
      data: execData,
    },
  ])
}

describe('робот решений совета: делегирование и проверка ключей по разрешению', () => {
  beforeAll(async () => {
    await bc.update_pass_instance()
    const boards: any[] = await bc.getTableRows(SovietContract.contractName.production, COOP, 'boards', 10)
    const soviet = boards.find(b => b.type === 'soviet')
    expect(soviet, 'на стенде есть совет').toBeTruthy()
    boardId = Number(soviet.id)
    expect(soviet.members.length, 'совет расширенный (reboot:extra)').toBeGreaterThanOrEqual(5)
    // чистое состояние: прошлый прогон мог оставить делегирования
    for (const m of ['petr', 'anna', 'mikhail', CHAIRMAN]) {
      if (await automatorRow(m)) await disautomate(m)
    }
  })

  it('роботу нельзя выдать разрешение active', async () => {
    await expect(transact([automateAction('petr', [FREE], [], 'active')]))
      .rejects.toThrow('отдельное разрешение')
  })

  it('рядовой член совета не может включить подпись протоколов', async () => {
    await issueRobotPermission('petr')
    await expect(transact([automateAction('petr', [FREE], [FREE])]))
      .rejects.toThrow('только председатель')
  })

  it('член совета делегирует роботу голосование по типу решения', async () => {
    await transact([automateAction('petr', [FREE], [])])
    const row = await automatorRow('petr')
    expect(row.permission_name).toBe(ROBOT_PERMISSION)
    expect(row.vote_types).toEqual([FREE])
    expect(row.authorize_types).toEqual([])
    expect(row).not.toHaveProperty('encrypted_private_key')
  })

  it('повестка сообщает номер решения в newsubmitted, робот голосует ключом разрешения', async () => {
    const { id, submittedId } = await newFreeDecision()
    expect(submittedId, 'decision_id в событии совпадает с записью').toBe(id)

    await voteAsCoop(await signVote(COOP, 'petr', id, robotKeys.petr.wif, ROBOT_PERMISSION))
    const decision = await decisionRow(id)
    expect(decision.votes_for).toContain('petr')
  })

  it('чужой ключ и ключ робота под видом active отклоняются', async () => {
    await issueRobotPermission('anna')
    await transact([automateAction('anna', [FREE], [])])
    const { id } = await newFreeDecision()
    const foreign = await generateKey()

    await expect(voteAsCoop(await signVote(COOP, 'anna', id, foreign.wif, ROBOT_PERMISSION)))
      .rejects.toThrow()
    await expect(voteAsCoop(await signVote(COOP, 'anna', id, robotKeys.anna.wif, 'active')))
      .rejects.toThrow()
    // а настоящим ключом разрешения — проходит
    await voteAsCoop(await signVote(COOP, 'anna', id, robotKeys.anna.wif, ROBOT_PERMISSION))
    expect((await decisionRow(id)).votes_for).toContain('anna')
  })

  it('робот не голосует по типу вне делегированного списка', async () => {
    await issueRobotPermission('mikhail')
    await transact([automateAction('mikhail', ['joincoop'], [])])
    const { id } = await newFreeDecision()
    await expect(voteAsCoop(await signVote(COOP, 'mikhail', id, robotKeys.mikhail.wif, ROBOT_PERMISSION)))
      .rejects.toThrow('не делегировано')
  })

  it('подпись голоса за одно решение не принимается за другое', async () => {
    const a = await newFreeDecision()
    const b = await newFreeDecision()
    const vote = await signVote(COOP, 'petr', a.id, robotKeys.petr.wif, ROBOT_PERMISSION)
    await expect(voteAsCoop({ ...vote, decision_id: b.id })).rejects.toThrow('не соответствует голосу')
  })

  it('ручной голос активным ключом принимается при включённой автоматизации', async () => {
    const { id } = await newFreeDecision()
    await voteAsMember(await signVote(COOP, 'petr', id))
    expect((await decisionRow(id)).votes_for).toContain('petr')
  })

  it('после отзыва делегирования голос робота отклоняется', async () => {
    await disautomate('petr')
    expect(await automatorRow('petr')).toBeUndefined()
    const { id } = await newFreeDecision()
    await expect(voteAsCoop(await signVote(COOP, 'petr', id, robotKeys.petr.wif, ROBOT_PERMISSION)))
      .rejects.toThrow('не включена')
  })

  it('председатель делегирует подпись протоколов: не тот тип отклоняется, свой — утверждает и исполняет', async () => {
    await issueRobotPermission(CHAIRMAN)
    await transact([automateAction(CHAIRMAN, [FREE], ['joincoop'])])

    const { id } = await newFreeDecision()
    // кворум: робот за ant, ручные anna и mikhail (3 из 5)
    await voteAsCoop(await signVote(COOP, CHAIRMAN, id, robotKeys.ant.wif, ROBOT_PERMISSION))
    await voteAsMember(await signVote(COOP, 'anna', id))
    await voteAsMember(await signVote(COOP, 'mikhail', id))
    expect((await decisionRow(id)).approved).toBe(true)

    // протокол без подписи председателя
    const foreignProtocol = await signProtocol('anna', id)
    await expect(authorizeAndExec(id, foreignProtocol, 'active')).rejects.toThrow('председател')

    // подпись робота по типу, который председатель не делегировал
    const robotProtocol = await signProtocol(CHAIRMAN, id, robotKeys.ant.wif)
    await expect(authorizeAndExec(id, robotProtocol, ROBOT_PERMISSION)).rejects.toThrow('не делегирована')

    // делегировал свободные решения — проходит, решение исполнено
    await transact([automateAction(CHAIRMAN, [FREE], [FREE])])
    await authorizeAndExec(id, await signProtocol(CHAIRMAN, id, robotKeys.ant.wif), ROBOT_PERMISSION)
    expect(await decisionRow(id)).toBeUndefined()

    // уборка: делегирования сняты, ручные сценарии других тестов не затронуты
    for (const m of ['anna', 'mikhail', CHAIRMAN]) await disautomate(m)
  })
})
