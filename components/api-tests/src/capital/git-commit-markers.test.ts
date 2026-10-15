/**
 * Благорост: привязка коммитов GitHub к задачам по маркерам
 * (test-registry/capital.git-commit-markers.yaml).
 *
 * Коммит с маркерами «[хеш задачи][@пайщик]» становится привязкой задачи.
 * Привязка репозитория к проекту сразу индексирует его базовую ветку; обход
 * по расписанию проходит все ветки. Одна правка учитывается один раз: тот же
 * коммит, дошедший до базовой ветки, помечает привязку канонической, а
 * переписанный коммит с той же правкой ложится алиасом, второй привязки не
 * появляется.
 *
 * GitHub на стенде играет подставной узел: набор задаёт ветки, коммиты и
 * правки и читает, какие запросы платформа отправила. Набор возвращает
 * настройки Благороста и отвязывает репозитории.
 */
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, caseName, gql, gqlError, stubRequests, stubReset, stubRoute, tokenOf, waitFor } from '../core'
import { createIssue, createLocalProject, tag } from './cap-access.helpers'

const COMMITS = 'github_sha html_url branch in_default_branch username commit_message consumed'
const ISSUE = `query($d:GetCapitalIssueByHashInput!){ capitalIssue(data:$d){ issue_hash linked_git_commits{ ${COMMITS} } } }`
const SET_REPO = 'mutation($d:SetCapitalProjectDevelopmentRepositoryUrlInput!){ capitalSetProjectDevelopmentRepositoryUrl(data:$d){ project_hash development_repository_url } }'
const EXTENSIONS = 'query($d:GetExtensionsInput){ getExtensions(data:$d){ name enabled config } }'
const UPDATE_EXTENSION = 'mutation($d:ExtensionInput!){ updateExtension(data:$d){ name enabled config } }'

const OWNER = 'blackbox-org'
const API = '/github/repos'

let chairman = ''
let T = ''
let originalConfig: Record<string, unknown> | null = null
const projects: string[] = []

/** Репозиторий теста: свой проект, свои задачи, свой путь на подставном узле. */
interface Repo { name: string, path: string, project: string }

function sha(label: string): string {
  return crypto.createHash('sha1').update(`${T}:${label}`).digest('hex')
}

function commit(id: string, message: string, parents: string[]) {
  return { sha: id, parents: parents.map(p => ({ sha: p })), commit: { message, author: { date: '2026-10-01T10:00:00Z' } } }
}

function marked(issueHash: string, text: string): string {
  return `[${issueHash}][@${CHAIRMAN.account}] ${text}`
}

function patch(line: string): string {
  return `@@ -1,3 +1,4 @@\n context\n+${line}\n context\n context`
}

async function repo(label: string): Promise<Repo> {
  const name = `${label}-${T}`
  const project = (await createLocalProject(CHAIRMAN, `Репозиторий ${name}`)).project_hash
  projects.push(project)
  return { name, path: `${API}/${OWNER}/${name}`, project }
}

async function issueIn(r: Repo, title: string): Promise<string> {
  const issue = await createIssue(CHAIRMAN, { title, project_hash: r.project, creators: [CHAIRMAN.account] })
  return String(issue.issue_hash).toLowerCase()
}

async function attach(r: Repo): Promise<void> {
  const d = await gql<any>(chairman, SET_REPO, { d: { project_hash: r.project, development_repository_url: `${OWNER}/${r.name}` } })
  expect(d.capitalSetProjectDevelopmentRepositoryUrl.development_repository_url).toBe(`https://github.com/${OWNER}/${r.name}`)
}

async function linked(issueHash: string): Promise<any[]> {
  const d = await gql<any>(chairman, ISSUE, { d: { issue_hash: issueHash } })
  return d.capitalIssue.linked_git_commits
}

async function waitLinked(issueHash: string, probe: (rows: any[]) => boolean, label: string): Promise<any[]> {
  return waitFor(async () => {
    const rows = await linked(issueHash)
    return probe(rows) ? rows : null
  }, { timeoutMs: 180_000, intervalMs: 2_000, label })
}

/** Ветки репозитория с вершинами — так их отдаёт листинг веток. */
async function branches(r: Repo, heads: Record<string, string>): Promise<void> {
  await stubRoute('GET', `${r.path}/branches`, { body: Object.entries(heads).map(([name, head]) => ({ name, commit: { sha: head } })) })
}

async function capitalConfig(): Promise<Record<string, unknown>> {
  const d = await gql<any>(chairman, EXTENSIONS, { d: { name: 'capital' } })
  return d.getExtensions[0].config
}

/** Опрос по расписанию: интервал в минутах; ноль — выключен. Смена настройки перезапускает опрос сразу. */
async function polling(minutes: number): Promise<void> {
  await gql(chairman, UPDATE_EXTENSION, {
    d: {
      name: 'capital',
      enabled: true,
      config: {
        ...originalConfig,
        github_sync_branch: 'dev',
        github_sync_all_branches: true,
        github_sync_branch_filter: '*',
        github_sync_poll_interval_minutes: minutes,
        github_api_token_encrypted: '',
      },
    },
  })
}

beforeAll(async () => {
  chairman = await tokenOf(CHAIRMAN)
  T = tag('git').replace(/[^a-z0-9-]/g, '')
  await stubReset()
  originalConfig = await capitalConfig()
}, 300_000)

afterAll(async () => {
  for (const project of projects)
    await gqlError(chairman, SET_REPO, { d: { project_hash: project, development_repository_url: null } })
  if (originalConfig) {
    await gqlError(chairman, UPDATE_EXTENSION, {
      d: { name: 'capital', enabled: true, config: { ...originalConfig, github_sync_poll_interval_minutes: 0, github_api_token_encrypted: '' } },
    })
  }
  await stubReset()
})

describe('Благорост — привязка коммитов GitHub по маркерам', () => {
  let main: Repo
  let issueBase = ''
  let issueFeature = ''
  const D1 = () => sha('dev-1')
  const MERGE = () => sha('dev-merge')
  const F1 = () => sha('feature-1')

  it(caseName('cap.gitmark.happy.02', 'репозиторий привязан к проекту — базовая ветка индексируется сразу, коммит с маркерами становится привязкой задачи'), async () => {
    main = await repo('main')
    issueBase = await issueIn(main, `Задача базовой ветки ${T}`)
    issueFeature = await issueIn(main, `Задача фича-ветки ${T}`)

    await branches(main, { 'dev': MERGE(), 'feature-x': F1() })
    await stubRoute('GET', `${main.path}/branches/dev`, { body: { name: 'dev', commit: { sha: MERGE() } } })
    // История базовой ветки, от новых к старым: слияние с маркерами и обычный коммит с маркерами.
    await stubRoute('GET', `${main.path}/commits`, {
      body: [
        commit(MERGE(), marked(issueBase, 'слияние ветки'), [D1(), sha('side')]),
        commit(D1(), marked(issueBase, 'правка расчёта'), [sha('root')]),
      ],
    })
    await stubRoute('GET', `${main.path}/commits/${D1()}`, { body: { sha: D1(), files: [{ filename: 'src/calc.ts', patch: patch('const rate = 2') }] } })

    await attach(main)
    const rows = await waitLinked(issueBase, r => r.length > 0, 'коммит базовой ветки привязан к задаче')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      github_sha: D1(),
      branch: 'dev',
      in_default_branch: true,
      username: CHAIRMAN.account,
      consumed: false,
    })
    expect(rows[0].html_url).toBe(`https://github.com/${OWNER}/${main.name}/commit/${D1()}`)
    expect(rows[0].commit_message).toContain('правка расчёта')
  })

  it(caseName('cap.gitmark.side.03', 'коммит слияния с маркерами в сообщении пропускается'), async () => {
    const rows = await linked(issueBase)
    expect(rows.map(r => r.github_sha)).not.toContain(MERGE())
    expect((await stubRequests(`${main.path}/commits/${MERGE()}`)), 'правку слияния платформа не запрашивала').toEqual([])
  })

  it(caseName('cap.gitmark.side.07', 'в репозитории нет настроенной ветки — индексируется его ветка по умолчанию'), async () => {
    const product = await repo('product')
    const issue = await issueIn(product, `Задача продукта ${T}`)
    const B1 = sha('main-1')
    await branches(product, { main: B1 })
    await stubRoute('GET', product.path, { body: { name: product.name, default_branch: 'main' } })
    await stubRoute('GET', `${product.path}/branches/main`, { body: { name: 'main', commit: { sha: B1 } } })
    await stubRoute('GET', `${product.path}/commits`, { body: [commit(B1, marked(issue, 'первый выпуск'), [sha('root-b')])] })
    await stubRoute('GET', `${product.path}/commits/${B1}`, { body: { sha: B1, files: [{ filename: 'README.md', patch: patch('выпуск') }] } })

    await attach(product)
    const rows = await waitLinked(issue, r => r.length > 0, 'коммит ветки по умолчанию привязан')
    expect(rows[0]).toMatchObject({ github_sha: B1, branch: 'main', in_default_branch: true })
  })

  describe('обход всех веток по расписанию', () => {
    let broken: Repo
    let issueBroken = ''
    const C1 = () => sha('broken-1')
    let orphan: Repo
    const O1 = () => sha('orphan-dev-1')
    const G1 = () => sha('orphan-pages-1')
    let perBranchBefore = 0

    beforeAll(async () => {
      // Фича-ветка впереди базовой на один коммит с маркерами.
      await stubRoute('GET', `${main.path}/compare/dev...${F1()}`, { body: { commits: [commit(F1(), marked(issueFeature, 'новая форма'), [MERGE()])] } })
      await stubRoute('GET', `${main.path}/commits/${F1()}`, { body: { sha: F1(), files: [{ filename: 'src/form.vue', patch: patch('<input />') }] } })

      // Репозиторий, у которого листинг веток не отвечает.
      broken = await repo('broken')
      issueBroken = await issueIn(broken, `Задача при сбое листинга ${T}`)
      await stubRoute('GET', `${broken.path}/branches`, { status: 503, body: { message: 'unavailable' } })
      await stubRoute('GET', `${broken.path}/branches/dev`, { body: { name: 'dev', commit: { sha: C1() } } })
      await stubRoute('GET', `${broken.path}/commits`, { body: [commit(C1(), marked(issueBroken, 'починка'), [sha('root-c')])] })
      await stubRoute('GET', `${broken.path}/commits/${C1()}`, { body: { sha: C1(), files: [{ filename: 'fix.ts', patch: patch('fix()') }] } })
      await attach(broken)

      // Репозиторий с веткой без общей истории с базовой (как gh-pages): сравнение
      // с базовой GitHub отвергает, и так будет всегда.
      orphan = await repo('orphan')
      const issueOrphan = await issueIn(orphan, `Задача рядом с осиротевшей веткой ${T}`)
      await branches(orphan, { 'dev': O1(), 'gh-pages': G1() })
      await stubRoute('GET', `${orphan.path}/branches/dev`, { body: { name: 'dev', commit: { sha: O1() } } })
      await stubRoute('GET', `${orphan.path}/commits`, { body: [commit(O1(), marked(issueOrphan, 'начало'), [sha('root-o')])] })
      await stubRoute('GET', `${orphan.path}/commits/${O1()}`, { body: { sha: O1(), files: [{ filename: 'a.ts', patch: patch('a()') }] } })
      await stubRoute('GET', `${orphan.path}/compare/dev...${G1()}`, { status: 404, body: { message: 'No common ancestor between dev and gh-pages.' } })
      await attach(orphan)

      perBranchBefore = (await stubRequests(`${main.path}/branches/*`)).length
      await polling(1)
    }, 300_000)

    it(caseName('cap.gitmark.happy.01', 'коммит с маркерами в фича-ветке привязан сразу — как ещё не дошедший до базовой'), async () => {
      const rows = await waitLinked(issueFeature, r => r.length > 0, 'коммит фича-ветки привязан к задаче')
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ github_sha: F1(), branch: 'feature-x', in_default_branch: false, username: CHAIRMAN.account })
    })

    it(caseName('cap.gitmark.side.05', 'небазовая ветка индексируется только коммитами впереди базовой — её история целиком не выкачивается'), async () => {
      const listings = await stubRequests(`${main.path}/commits`)
      expect(listings.length).toBeGreaterThan(0)
      expect(listings.every(r => r.query.sha === 'dev'), 'листинг истории запрошен только по базовой ветке').toBe(true)
      expect((await stubRequests(`${main.path}/compare/dev...${F1()}`)).length).toBeGreaterThan(0)
    })

    it(caseName('cap.gitmark.side.08', 'вершины веток берутся из листинга — отдельного запроса на ветку обход не делает'), async () => {
      expect((await stubRequests(`${main.path}/branches`)).length).toBeGreaterThan(0)
      expect((await stubRequests(`${main.path}/branches/*`)).length, 'запросов по отдельной ветке не прибавилось').toBe(perBranchBefore)
    })

    it(caseName('cap.gitmark.break.02', 'листинг веток не отвечает — репозиторий обходится по настроенной ветке, остальные репозитории не страдают'), async () => {
      const rows = await waitLinked(issueBroken, r => r.length > 0, 'коммит репозитория со сбоем листинга привязан')
      expect(rows[0]).toMatchObject({ github_sha: C1(), branch: 'dev', in_default_branch: true })
      expect((await stubRequests(`${broken.path}/branches/dev`)).length, 'вершина настроенной ветки запрошена отдельно').toBeGreaterThan(0)
    })

    it(caseName('cap.gitmark.side.09', 'у ветки нет общей истории с базовой — сравнение запрашивается один раз, дальше ветка пропускается'), async () => {
      const compare = `${orphan.path}/compare/dev...${G1()}`
      const passes = async () => (await stubRequests(`${orphan.path}/branches`)).length
      const opts = { timeoutMs: 280_000, intervalMs: 2_000 }

      await waitFor(async () => (await stubRequests(compare)).length > 0 ? true : null, { ...opts, label: 'обход дошёл до ветки без общей истории' })
      // Следующий листинг веток — знак, что проход, в котором было сравнение, закончился.
      const afterFirst = await passes() + 1
      await waitFor(async () => (await passes()) >= afterFirst ? true : null, { ...opts, label: 'начался следующий проход' })
      const asked = (await stubRequests(compare)).length

      // Ещё два прохода: до правки сравнение повторялось в каждом (C28-88).
      await waitFor(async () => (await passes()) >= afterFirst + 2 ? true : null, { ...opts, label: 'прошли ещё два прохода обхода' })
      expect((await stubRequests(compare)).length, 'сравнение осиротевшей ветки не повторялось').toBe(asked)
    }, 900_000)

    it(caseName('cap.gitmark.side.01', 'тот же коммит дошёл до базовой ветки — привязка стала канонической, второй не появилось'), async () => {
      const HEAD = sha('dev-2')
      const R1 = sha('rebased-1')
      // Фича-ветку влили в базовую без переписывания; в новой ветке лежит переписанный коммит базовой.
      await stubRoute('GET', `${main.path}/compare/${MERGE()}...${HEAD}`, {
        body: { commits: [commit(F1(), marked(issueFeature, 'новая форма'), [MERGE()]), commit(HEAD, 'обычный коммит без маркеров', [F1()])] },
      })
      await stubRoute('GET', `${main.path}/compare/dev...${R1}`, { body: { commits: [commit(R1, marked(issueBase, 'правка расчёта (rebase)'), [HEAD])] } })
      await stubRoute('GET', `${main.path}/commits/${R1}`, { body: { sha: R1, files: [{ filename: 'src/calc.ts', patch: patch('const rate = 2') }] } })
      await branches(main, { 'dev': HEAD, 'feature-x': F1(), 'feature-y': R1 })

      const rows = await waitLinked(issueFeature, r => r[0]?.in_default_branch === true, 'привязка фича-коммита стала канонической')
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ github_sha: F1(), in_default_branch: true })
    })

    it(caseName('cap.gitmark.side.02', 'переписанный коммит с той же правкой ложится алиасом — задача по-прежнему с одной привязкой'), async () => {
      const R1 = sha('rebased-1')
      await waitFor(async () => (await stubRequests(`${main.path}/commits/${R1}`)).length > 0 ? true : null,
        { timeoutMs: 180_000, intervalMs: 2_000, label: 'правка переписанного коммита запрошена' })
      // timing: timeout — правка получена, запись алиаса идёт следом в том же проходе ветки
      await new Promise(r => setTimeout(r, 3_000))

      const rows = await linked(issueBase)
      expect(rows, 'вторая привязка не появилась').toHaveLength(1)
      expect(rows[0]).toMatchObject({ github_sha: D1(), in_default_branch: true, consumed: false })
    })
  })
})
