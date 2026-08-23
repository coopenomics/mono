/**
 * Контрактный уровень: соавторы проекта ЦПП «Благорост»
 * (реестр capital.project-contributors, level contract).
 *
 * Соавтором проекта можно назначить только участника, допущенного к работам по
 * нему — то есть подписавшего приложение к договору об участии ИМЕННО по этому
 * проекту. Назначение не создаёт вторую долю: если доля у участника уже есть
 * (например, он вложился в проект деньгами), к ней добавляется авторский
 * признак.
 *
 * Тест самодостаточен: заводит свой проект, своего мастера и своих участников.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CapitalContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { generateRandomSHA256 } from '../utils/randomHash'
import { fakeDocument } from './shared/fakeDocument'
import { signAppendix } from './capital/signAppendix'
import { getSegment } from './capital/getSegment'
import { ratePerHour } from './capital/consts'
import { COOP, bootstrapMember, minor, rub, signedBy } from './capital/programInvest'

const bc = new Blockchain(config.network, config.private_keys)
const ZERO_HASH = '0'.repeat(64)

/** Предел из контракта (capital.hpp): больше двенадцати соавторов не бывает. */
const MAX_PROJECT_AUTHORS = 12

const PLAN_EXPENSES = 10_000
const INVEST = 30_000

let project = ''
let master = ''
let coauthor = ''
let investor = ''

async function send(name: string, data: Record<string, unknown>) {
  return bc.api.transact({
    actions: [{
      account: CapitalContract.contractName.production,
      name,
      authorization: [{ actor: COOP, permission: 'active' }],
      data,
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

async function projectSegments(projectHash: string): Promise<any[]> {
  const rows = await bc.getTableRows(CapitalContract.contractName.production, COOP, 'segments', 1000) as any[]
  return rows.filter(r => r.project_hash === projectHash)
}

async function getProjectRow(hash: string): Promise<any> {
  const rows = await bc.getTableRows(
    CapitalContract.contractName.production, COOP, 'projects', 1, hash, hash, 3, 'sha256',
  ) as any[]
  return rows[0]
}

/** Участник, допущенный к работам по проекту: договор + приложение по проекту. */
async function admittedMember(deposit = 0): Promise<string> {
  const username = await bootstrapMember(bc, { deposit })
  await signAppendix(bc, COOP, username, project, generateRandomSHA256())
  return username
}

async function addAuthor(username: string) {
  return send(CapitalContract.Actions.AddAuthor.actionName, {
    coopname: COOP, project_hash: project, author: username,
  })
}

describe('Благорост — соавторы проекта (contract, живая цепь)', () => {
  beforeAll(async () => {
    await bc.update_pass_instance()

    // Проект без родителя: компонент нельзя запустить, пока родитель не активен.
    project = generateRandomSHA256()
    await send(CapitalContract.Actions.CreateProject.actionName, {
      coopname: COOP,
      project_hash: project,
      parent_hash: ZERO_HASH,
      title: `Проект соавторов ${project.slice(0, 8)}`,
      description: 'Проект контрактного теста соавторства.',
      invite: '',
      data: '',
      meta: '',
    })

    master = await admittedMember()
    await send(CapitalContract.Actions.SetMaster.actionName, {
      coopname: COOP, project_hash: project, master,
    })

    // План → запуск → открытие приёма инвестиций: нужно, чтобы у участника
    // могла появиться доля БЕЗ авторского признака (доля инвестора).
    await send(CapitalContract.Actions.SetPlan.actionName, {
      coopname: COOP,
      master,
      project_hash: project,
      plan_creators_hours: 100,
      plan_expenses: rub(PLAN_EXPENSES),
      plan_hour_cost: ratePerHour,
    })
    await send(CapitalContract.Actions.StartProject.actionName, {
      coopname: COOP, project_hash: project,
    })
    await send(CapitalContract.Actions.OpenProject.actionName, {
      coopname: COOP, project_hash: project,
    })

    const row = await getProjectRow(project)
    expect(row.status, 'предусловие: проект запущен').toBe('active')
    expect(Number(row.is_opened), 'предусловие: проект открыт для инвестиций').toBe(1)
  }, 900_000)

  it('cap.contrib.happy.01: соавтору из числа допущенных к работам заводится доля с авторским признаком', async () => {
    coauthor = await admittedMember()

    const before = await getProjectRow(project)
    const segmentsBefore = await projectSegments(project)
    expect(await getSegment(bc, COOP, project, coauthor).catch(() => undefined),
      'предусловие: доли у участника ещё нет').toBeFalsy()

    await addAuthor(coauthor)

    const segment = await getSegment(bc, COOP, project, coauthor)
    expect(Number(segment.is_author), 'участнику обязан появиться авторский признак').toBe(1)

    const after = await getProjectRow(project)
    expect(Number(after.counts.total_authors),
      'счётчик соавторов проекта обязан вырасти на одного').toBe(Number(before.counts.total_authors) + 1)
    expect((await projectSegments(project)).length,
      'у участника без доли обязана появиться ровно одна новая доля').toBe(segmentsBefore.length + 1)
  }, 900_000)

  it('cap.contrib.happy.01 (вторая половина): если доля уже есть, признак добавляется к ней, вторая доля не создаётся', async () => {
    investor = await admittedMember(200_000)

    // Доля БЕЗ авторского признака: участник вложился в проект деньгами.
    await send(CapitalContract.Actions.CreateProjectInvest.actionName, {
      coopname: COOP,
      project_hash: project,
      username: investor,
      invest_hash: generateRandomSHA256(),
      amount: rub(INVEST),
      statement: signedBy(investor),
    })

    const segmentBefore = await getSegment(bc, COOP, project, investor)
    expect(Number(segmentBefore.is_investor), 'предусловие: доля инвестора появилась').toBe(1)
    expect(Number(segmentBefore.is_author), 'предусловие: авторского признака на ней ещё нет').toBe(0)

    const segmentsBefore = await projectSegments(project)
    await addAuthor(investor)

    const segmentAfter = await getSegment(bc, COOP, project, investor)
    expect(Number(segmentAfter.id),
      'признак обязан лечь на ТУ ЖЕ долю — идентификатор не меняется').toBe(Number(segmentBefore.id))
    expect(Number(segmentAfter.is_author), 'авторский признак обязан добавиться').toBe(1)
    expect(Number(segmentAfter.is_investor), 'признак инвестора обязан сохраниться').toBe(1)
    expect((await projectSegments(project)).length,
      'вторая доля создаваться не должна').toBe(segmentsBefore.length)
  }, 900_000)

  it('cap.contrib.side.01: повторное назначение соавтором отклоняется', async () => {
    await expect(addAuthor(coauthor)).rejects.toThrow(/уже является автором проекта/i)
  }, 600_000)

  it('cap.contrib.side.02: соавтором нельзя назначить того, кто не допущен к работам по проекту', async () => {
    // Договор об участии есть, приложения ИМЕННО по этому проекту — нет.
    const outsider = await bootstrapMember(bc, { deposit: 0 })
    await expect(addAuthor(outsider)).rejects.toThrow()
  }, 900_000)

  it('cap.contrib.side.03: сверх предельного количества соавторов назначение отклоняется', async () => {
    const before = await getProjectRow(project)
    let authors = Number(before.counts.total_authors)
    expect(authors, 'предусловие: предел ещё не выбран').toBeLessThan(MAX_PROJECT_AUTHORS)

    // Добираем до предела. Мастер тоже автор, поэтому считаем от текущего.
    while (authors < MAX_PROJECT_AUTHORS) {
      await addAuthor(await admittedMember())
      authors = Number((await getProjectRow(project)).counts.total_authors)
    }
    expect(authors, 'предел обязан быть выбран ровно').toBe(MAX_PROJECT_AUTHORS)

    const extra = await admittedMember()
    await expect(addAuthor(extra)).rejects.toThrow(/Превышено максимальное количество соавторов/i)

    expect(Number((await getProjectRow(project)).counts.total_authors),
      'отклонённое назначение не должно менять счётчик').toBe(MAX_PROJECT_AUTHORS)
  }, 3_000_000)
})
