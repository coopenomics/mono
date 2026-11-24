import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import Blockchain from '../blockchain'
import config from '../configs'
import { addUser } from '../init/participant'
import { generateRandomSHA256 } from '../utils/randomHash'
import { generateRandomUsername } from '../utils/randomUsername'
import { chainTextDigest } from '../utils/chainTextDigest'
import { signedDocument } from './shared/fakeDocument'

/**
 * Общее собрание уполномоченных (компонент 76, задача A86-1).
 *
 * Форма собрания — собрание пайщиков или собрание уполномоченных —
 * закрепляется в записи собрания при одобрении советом (meet::authmeet) и до
 * закрытия не меняется. Проверяется на цепи стенда в обеих формах:
 *   • собрание пайщиков: голосует любой активный пайщик, кворум от пайщиков;
 *     третий участок во время собрания форму собрания не меняет;
 *   • собрание уполномоченных: рядовой пайщик получает отказ, председатель
 *     участка голосует, кворум от числа участков на момент одобрения;
 *   • подтверждение уведомления — только председатели участков;
 *   • после смены председателя участок второй голос не подаёт;
 *   • председатель участка, созданного после одобрения, не голосует;
 *   • повторное собрание закрепляет форму по составу на новое одобрение.
 *
 * Запускать на поднятом стенде тестовой сборки (порог пайщиков 0: система
 * участков включается тремя участками). Тест создаёт свои участки, голосует
 * их председателями и удаляет их в конце — кооператив возвращается в прежнюю
 * форму. На стенде, уже работающем по системе участков (boot:extra, полигон
 * Blackbox), часть «собрание пайщиков» пропускается.
 */
const COOP = config.provider
const CHAIRMAN = config.provider_chairman
const SOVIET = 'soviet'
const blockchain = new Blockchain(config.network, config.private_keys)

// Одинаковые подряд транзакции в одном блоке цепь приняла бы за повтор:
// у каждой свой срок действия.
let txSeq = 0
async function push(account: string, name: string, actor: string, data: object) {
  txSeq = (txSeq + 1) % 600
  return blockchain.api.transact(
    { actions: [{ account, name, authorization: [{ actor, permission: 'active' }], data }] },
    { blocksBehind: 3, expireSeconds: 30 + txSeq },
  )
}

const iso = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 19)
const nowSec = () => Math.floor(Date.now() / 1000)

/** Создаёт собрание с одним вопросом и одобряет его советом; окно голосования уже открыто. */
async function announceMeet(closeInSec = 3600): Promise<string> {
  const hash = generateRandomSHA256()
  const now = nowSec()
  await push('meet', 'createmeet', COOP, {
    coopname: COOP,
    hash,
    initiator: CHAIRMAN,
    presider: CHAIRMAN,
    secretary: CHAIRMAN,
    agenda: [{ title: chainTextDigest('Утвердить отчёт'), context: '', decision: chainTextDigest('Утвердить') }],
    proposal: signedDocument(generateRandomSHA256()),
    open_at: iso(now - 60),
    close_at: iso(now + closeInSec),
  })
  await authorize(hash)
  return hash
}

async function authorize(hash: string) {
  await push('meet', 'authmeet', SOVIET, { coopname: COOP, hash, authorization: signedDocument(generateRandomSHA256()) })
}

async function meetOf(hash: string): Promise<any> {
  const rows = await blockchain.getTableRows('meet', COOP, 'meets', 1, hash, hash, 2, 'sha256')
  return rows[0]
}

async function vote(hash: string, username: string) {
  const meet = await meetOf(hash)
  const id = String(meet.id)
  const questions = await blockchain.getTableRows('meet', COOP, 'questions', 100, id, id, 2, 'i64')
  return push('meet', 'vote', COOP, {
    coopname: COOP,
    hash,
    username,
    ballot: signedDocument(generateRandomSHA256()),
    votes: questions.map((q: any) => ({ question_id: q.id, vote: 'for' })),
  })
}

async function notify(hash: string, username: string) {
  return push('meet', 'gmnotify', COOP, { coopname: COOP, hash, username, notification: signedDocument(generateRandomSHA256()) })
}

/** Логическое поле строки цепи: узел отдаёт его числом или булевым. */
const flag = (v: unknown) => Boolean(Number(v))

async function branched(): Promise<boolean> {
  const rows = await blockchain.getTableRows('registrator', 'registrator', 'coops', 1, COOP, COOP)
  return flag(rows[0].is_branched)
}

async function branchCount(): Promise<number> {
  const rows = await blockchain.getTableRows('branch', 'branch', 'branchstat', 1, COOP, COOP)
  return rows.length ? Number(rows[0].count) : 0
}

async function activeParticipants(): Promise<number> {
  const rows = await blockchain.getTableRows('registrator', 'registrator', 'coops', 1, COOP, COOP)
  return Number(rows[0].active_participants_count)
}

async function newUser(): Promise<string> {
  const username = generateRandomUsername()
  await addUser(username)
  return username
}

// Участки, созданные тестом, — удаляются в afterAll.
const created: string[] = []

async function createBranch(trustee: string): Promise<string> {
  const braname = generateRandomUsername()
  await push('branch', 'createbranch', COOP, { coopname: COOP, braname, trustee })
  created.push(braname)
  return braname
}

// Отметка времени закрепления формы — секунды; участок, созданный в ту же
// секунду, что и одобрение, считался бы существовавшим до одобрения. Пауза
// разводит события по разным секундам (на живой цепи между ними дни).
const nextSecond = () => new Promise(resolve => setTimeout(resolve, 1100)) // timing: timeout — разнести события цепи по разным секундам

let PARTICIPANT_A = ''
let PARTICIPANT_B = ''
// Председатели и участки, созданные тестом: на них он голосует и их удаляет.
const trustees: string[] = []
const branches: string[] = []
// Стенд boot:extra (полигон Blackbox) уже работает по системе участков — там
// собрание пайщиков не созвать, и эта часть пропускается. На чистом стенде
// тест сам включает систему участков посреди собрания пайщиков.
let STARTED_BRANCHED = false

async function addOwnBranch(): Promise<void> {
  const trustee = await newUser()
  trustees.push(trustee)
  branches.push(await createBranch(trustee))
}

/** Система участков включена, и у теста не меньше двух своих участков. */
async function ensureTrusteesStand(): Promise<void> {
  while (branches.length < 2 || !(await branched()))
    await addOwnBranch()
}

beforeAll(async () => {
  await blockchain.update_pass_instance()
  STARTED_BRANCHED = await branched()
  PARTICIPANT_A = await newUser()
  PARTICIPANT_B = await newUser()
}, 240_000)

afterAll(async () => {
  for (const braname of created.reverse())
    await push('branch', 'deletebranch', COOP, { coopname: COOP, braname }).catch(() => undefined)
}, 240_000)

describe('собрание пайщиков', () => {
  let MEET = ''

  it('одобрение советом закрепляет форму собрания пайщиков', async (ctx) => {
    if (STARTED_BRANCHED)
      ctx.skip()
    MEET = await announceMeet()
    const meet = await meetOf(MEET)
    expect(flag(meet.form.is_branched)).toBe(false)
    expect(Number(meet.form.branches_count)).toBe(0)
    expect(meet.form.voted_branches).toEqual([])
  }, 120_000)

  it('голосует рядовой пайщик, кворум считается от активных пайщиков', async (ctx) => {
    if (STARTED_BRANCHED)
      ctx.skip()
    await vote(MEET, PARTICIPANT_A)
    const meet = await meetOf(MEET)
    expect(Number(meet.signed_ballots)).toBe(1)
    expect(Number(meet.current_quorum_percent)).toBeCloseTo(100 / (await activeParticipants()), 6)
  }, 120_000)

  it('система участков, включённая во время собрания, форму собрания не меняет', async (ctx) => {
    if (STARTED_BRANCHED)
      ctx.skip()
    await ensureTrusteesStand()
    expect(await branched()).toBe(true)

    await vote(MEET, PARTICIPANT_B)
    const meet = await meetOf(MEET)
    expect(flag(meet.form.is_branched)).toBe(false)
    expect(Number(meet.signed_ballots)).toBe(2)
    expect(Number(meet.current_quorum_percent)).toBeCloseTo(200 / (await activeParticipants()), 6)
  }, 240_000)
})

describe('собрание уполномоченных', () => {
  let MEET = ''

  it('новый участок получает дату создания и полный хвост расширений', async () => {
    await ensureTrusteesStand()
    const rows = await blockchain.getTableRows('branch', COOP, 'branches', 1, branches[0], branches[0])
    expect(rows[0].created_at).toBeTruthy()
    expect(flag(rows[0].is_private)).toBe(false)
    expect(rows[0].whitelist).toEqual([])
  }, 60_000)

  it('одобрение советом закрепляет форму собрания уполномоченных и число участков', async () => {
    await nextSecond()
    MEET = await announceMeet()
    const meet = await meetOf(MEET)
    expect(flag(meet.form.is_branched)).toBe(true)
    expect(Number(meet.form.branches_count)).toBe(await branchCount())
  }, 120_000)

  it('рядовой пайщик не голосует', async () => {
    await expect(vote(MEET, PARTICIPANT_A)).rejects.toThrow(/MEET_NOT_TRUSTEE/)
  }, 60_000)

  it('рядовой пайщик не подтверждает уведомление, председатель участка подтверждает', async () => {
    await expect(notify(MEET, PARTICIPANT_A)).rejects.toThrow(/MEET_NOT_TRUSTEE/)
    await notify(MEET, trustees[0])
    expect((await meetOf(MEET)).notified_users).toContain(trustees[0])
  }, 60_000)

  it('председатель участка голосует, кворум — доля участков', async () => {
    await vote(MEET, trustees[0])
    const meet = await meetOf(MEET)
    expect(meet.form.voted_branches).toEqual([branches[0]])
    expect(Number(meet.current_quorum_percent)).toBeCloseTo(100 / Number(meet.form.branches_count), 6)
  }, 60_000)

  it('после смены председателя участок второй голос не подаёт', async () => {
    const successor = await newUser()
    await push('branch', 'editbranch', COOP, { coopname: COOP, braname: branches[0], trustee: successor })
    await expect(vote(MEET, successor)).rejects.toThrow(/MEET_BRANCH_ALREADY_VOTED/)
    expect(Number((await meetOf(MEET)).signed_ballots)).toBe(1)
  }, 120_000)

  it('председатель участка, созданного после одобрения, не голосует и не подтверждает уведомление', async () => {
    await nextSecond()
    const late = await newUser()
    await createBranch(late)
    await expect(vote(MEET, late)).rejects.toThrow(/MEET_BRANCH_NOT_IN_MEET/)
    await expect(notify(MEET, late)).rejects.toThrow(/MEET_BRANCH_NOT_IN_MEET/)
  }, 120_000)
})

describe('повторное собрание уполномоченных', () => {
  it('новое одобрение закрепляет форму по текущему составу и сбрасывает голоса участков', async () => {
    const hash = await announceMeet(5)
    await vote(hash, trustees[1])
    const before = await meetOf(hash)
    expect(before.form.voted_branches).toEqual([branches[1]])
    expect(flag(before.quorum_passed)).toBe(false)

    // Окно голосования закрыто, кворум (75 %) не собран — инициатор созывает повторное собрание.
    await new Promise(resolve => setTimeout(resolve, 6000)) // timing: timeout — дождаться закрытия окна голосования
    const newHash = generateRandomSHA256()
    const now = nowSec()
    await push('meet', 'restartmeet', COOP, {
      coopname: COOP,
      hash,
      new_hash: newHash,
      newproposal: signedDocument(generateRandomSHA256()),
      new_open_at: iso(now - 60),
      new_close_at: iso(now + 3600),
    })

    // Во время повторного созыва председатель кооператива создаёт ещё один участок.
    const extra = await newUser()
    await createBranch(extra)
    await nextSecond()
    await authorize(newHash)

    const after = await meetOf(newHash)
    expect(flag(after.form.is_branched)).toBe(true)
    expect(Number(after.form.branches_count)).toBe(await branchCount())
    expect(Number(after.form.branches_count)).toBe(Number(before.form.branches_count) + 1)
    expect(after.form.voted_branches).toEqual([])
    expect(after.form.fixed_at > before.form.fixed_at).toBe(true)

    // Председатель участка, проголосовавшего в прошлом цикле, голосует снова.
    await vote(newHash, trustees[1])
    expect((await meetOf(newHash)).form.voted_branches).toEqual([branches[1]])
  }, 240_000)
})
