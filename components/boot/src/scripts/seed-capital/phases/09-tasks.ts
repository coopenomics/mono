/**
 * Фаза 09 — задачи (issues) в компоненте «MVP v1».
 *
 * Создаёт через controller GraphQL (capitalCreateIssue) набор задач разных
 * статусов от имени мастера `ant`:
 *   1) ivanpetrov, 30 ч, status=DONE  («выполнена»)  → 30 ч available_hours для коммита
 *   2) ekaterina,  20 ч, status=DONE  («выполнена»)  → 20 ч available_hours для коммита
 *   3) ivanpetrov, 4 ч,  status=IN_PROGRESS         → ещё «в работе», часы недоступны
 *
 * Идея — после этой фазы каждый из двух исполнителей видит на странице
 * «Моё время» свои задачи, и кнопка «Создать коммит» в строке проекта
 * становится активной (uncommittedHours = available_hours ≥ 1).
 *
 * Идемпотентно: если задача с таким title в проекте уже есть — пропуск.
 *
 * Зависит от:
 *   - phase 07 — компонент имеет мастера `ant` и план (без плана task создание
 *     валидируется по-другому, и applyExplicitEstimateToTimeEntries не сработает).
 *   - phases 04, 05 — все три участника зарегистрированы как Contributor с
 *     активным договором УХД.
 *
 * НЕ создаёт сами коммиты — это задача сценария blagorost/commits.mjs (UI-документация).
 */
import { Client, Mutations, Queries } from '@coopenomics/sdk'
import { createHash } from 'node:crypto'
import Blockchain from '../../../blockchain'
import config from '../../../configs'

const log = (...a: unknown[]) => console.error('[seed-capital:09]', ...a)

const COOPNAME = 'voskhod'
const CHAIRMAN = 'ant'
const CHAIRMAN_EMAIL = 'ivanov@example.com'
const COMPONENT_HASH = createHash('sha256').update('blago:project:49').digest('hex')

// GraphQL-enum IssueStatus принимает значения в верхнем регистре (BACKLOG, TODO,
// IN_PROGRESS, ON_REVIEW, DONE, CANCELED). Внутреннее значение в БД — 'done',
// 'in_progress' и т.д. (lowercase), но в API только UPPERCASE.
type IssueStatusEnum = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'ON_REVIEW' | 'DONE' | 'CANCELED'

interface ITaskSeed {
  title: string
  description: string
  estimate: number
  creators: string[]
  status: IssueStatusEnum
}

const TASKS: ITaskSeed[] = [
  {
    title: 'Поднять Vue-каркас кошелька',
    description: 'Базовая навигация, маршруты, layout главной страницы — без реальной логики кошельков.',
    estimate: 30,
    creators: ['ivanpetrov'],
    status: 'DONE',
  },
  {
    title: 'Виджет балансов и истории операций',
    description: 'Компонент отображения двух кошельков (Генерация / Благорост) и списка последних операций.',
    estimate: 20,
    creators: ['ekaterina'],
    status: 'DONE',
  },
  {
    title: 'Документация модулей',
    description: 'README + jsdoc по основным модулям; черновая, без скриншотов.',
    estimate: 4,
    creators: ['ivanpetrov'],
    status: 'IN_PROGRESS',
  },
  // Задача без estimate — иллюстрирует «время по факту»: cron каждый час
  // добавляет 1ч / число активных задач без estimate у contributor'а.
  // На странице «Моё время» по этой задаче часы должны тикать сами без
  // явной оценки. Используется в инструкции tasks.md (двойной режим time-tracking).
  {
    title: 'Исследование альтернативных адаптеров кошелька',
    description: 'Без чёткой оценки: пробуем подходы, фиксируем что нашли. Время по факту.',
    estimate: 0,
    creators: ['ekaterina'],
    status: 'IN_PROGRESS',
  },
]

interface IIssueRow {
  issue_hash: string
  title: string
  status: string
  estimate?: number
  creators?: string[]
}

export async function phase09(): Promise<void> {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  const info = await blockchain.getInfo()
  const chainId = info.chain_id
  const chainUrl = `${config.network.protocol}://${config.network.host}${config.network.port}`
  const apiUrl = process.env.CONTROLLER_GRAPHQL_URL || 'http://127.0.0.1:2998/v1/graphql'

  const wif = config.private_keys[0]
  if (!wif) throw new Error('EOSIO_PRV_KEY не задан в env')

  const client = Client.create({
    api_url: apiUrl,
    chain_url: chainUrl,
    chain_id: chainId,
    wif,
    username: CHAIRMAN,
  })
  log(`логин ${CHAIRMAN_EMAIL} (мастер компонента)...`)
  await client.login(CHAIRMAN_EMAIL, wif)

  // Список существующих задач компонента — для идемпотентности
  let existing: IIssueRow[] = []
  try {
    const resp = await client.Query(Queries.Capital.GetIssues.query, {
      variables: {
        filter: { coopname: COOPNAME, project_hash: COMPONENT_HASH },
        options: { page: 1, limit: 100 },
      } as Queries.Capital.GetIssues.IInput,
    }) as Record<string, { items?: IIssueRow[] } | null>
    const out = resp[Queries.Capital.GetIssues.name]
    existing = out?.items ?? []
  } catch (e) {
    log(`Query GetIssues упал (это ок при первом запуске): ${(e as Error).message?.slice(0, 100)}`)
  }
  const existingTitles = new Set(existing.map((x) => x.title))

  for (const t of TASKS) {
    if (existingTitles.has(t.title)) {
      log(`задача «${t.title}» уже есть — пропуск`)
      continue
    }
    log(`создаю задачу «${t.title}» (creator=${t.creators[0]}, ${t.estimate}ч, status=${t.status})`)
    await client.Mutation(Mutations.Capital.CreateIssue.mutation, {
      variables: {
        data: {
          coopname: COOPNAME,
          title: t.title,
          description: t.description,
          estimate: t.estimate,
          creators: t.creators,
          status: t.status,
          project_hash: COMPONENT_HASH,
        },
      } as Mutations.Capital.CreateIssue.IInput,
    })
  }

  log('фаза 09 завершена')
}
