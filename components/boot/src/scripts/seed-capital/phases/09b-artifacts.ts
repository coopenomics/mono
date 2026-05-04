/**
 * Фаза 09b — артефакты компонента/проекта (для документации artifacts.md).
 *
 * Создаёт через controller GraphQL (capitalCreateStory) набор артефактов
 * на компоненте «MVP v1» и на проекте «Кошелёк пайщика», по одному
 * для каждого из 4 форматов:
 *   - Markdown (на компоненте) — текстовое требование с заголовками и списком
 *   - Mermaid  (на компоненте) — sequence-диаграмма потока коммитов
 *   - BPMN     (на компоненте) — пустой шаблон (контроллер сам подставит EMPTY_BPMN_STORY_XML)
 *   - drawio   (на компоненте) — пустой шаблон
 *   - Markdown (на проекте)    — общая концепция проекта
 *
 * Идея — после фазы:
 *   - вкладка «Артефакты» компонента содержит 4 артефакта разных форматов;
 *   - вкладка «Артефакты» проекта содержит 1 общую концепцию;
 *   - каждый артефакт можно открыть → видно конкретный редактор формата.
 *
 * Идемпотентно: артефакты создаются с детерминированными `story_hash`,
 * перед созданием проверяется наличие через GetStories.
 *
 * Зависит от:
 *   - phase 06 — проект «Кошелёк пайщика» и компонент «MVP v1» уже созданы.
 *   - phase 07 — у компонента есть мастер `ant`; can_create_requirement
 *     для мастера = true.
 */
import { Client, Mutations, Queries } from '@coopenomics/sdk'
import { createHash } from 'node:crypto'
import Blockchain from '../../../blockchain'
import config from '../../../configs'

const log = (...a: unknown[]) => console.error('[seed-capital:09b]', ...a)

const COOPNAME = 'voskhod'
const CHAIRMAN = 'ant'
const CHAIRMAN_EMAIL = 'ivanov@example.com'

const PROJECT_HASH = createHash('sha256').update('blago:project:48').digest('hex')
const COMPONENT_HASH = createHash('sha256').update('blago:project:49').digest('hex')

type ContentFormat = 'MARKDOWN' | 'MERMAID' | 'BPMN' | 'DRAWIO'

interface IArtifactSeed {
  /** Стабильный hash для идемпотентности — производится из (project_hash, title) */
  hashSeed: string
  parentHash: string
  parentLabel: string
  title: string
  content_format: ContentFormat
  description: string
}

const MARKDOWN_BODY = `## Требования к экрану «Кошелёк»

### Состав

- Виджет балансов: **Главный кошелёк** и **ЦПП «Благорост»**.
- Список последних 10 операций по любому из кошельков.
- Кнопка «Получить долю» рядом с компонентами, готовыми к выкупу РИД.

### Поведение

- При открытии экран загружает балансы и историю операций.
- Empty state: «Здесь будут отображаться ваши операции».
- Любая операция кликабельна и открывает её детали.

### Не входит в этот компонент

- Подписание Акта приёма-передачи РИД — живёт в отдельном компоненте «Приёмка РИД».
- Импорт/экспорт паевых взносов — в роадмапе, после MVP.
`

const MERMAID_BODY = `sequenceDiagram
    participant И as Исполнитель
    participant М as Мастер компонента
    participant К as Кооператив

    И->>М: Зафиксировать коммит (часы, отзыв)
    М->>М: Поставить звёздочки удовлетворения
    М->>И: Принять или вернуть на доработку
    Note over М,К: После приёмки коммит<br/>входит в РИД компонента
    М->>К: Внести результат (pushrslt)
`

const PROJECT_CONCEPT_BODY = `## Концепция: Кошелёк пайщика

Цель проекта — дать пайщику единый экран, на котором видны:

- баланс по двум кошелькам (Главный + ЦПП «Благорост»);
- история операций;
- готовые к выкупу доли в ОАП по компонентам.

### Целевая аудитория

- Активные пайщики, участвующие в нескольких компонентах.
- Координаторы — для быстрого обзора движения средств по программе.

### Контекст

Артефакт описывает проект целиком, поэтому виден всем его компонентам:
MVP v1, последующим версиям, доп. компонентам приёмки и отчётности.
`

const ARTIFACTS: IArtifactSeed[] = [
  {
    hashSeed: 'blago:story:component:markdown:requirements-wallet',
    parentHash: COMPONENT_HASH,
    parentLabel: 'компонент MVP v1',
    title: 'Требования к экрану «Кошелёк»',
    content_format: 'MARKDOWN',
    description: MARKDOWN_BODY,
  },
  {
    hashSeed: 'blago:story:component:mermaid:commit-flow',
    parentHash: COMPONENT_HASH,
    parentLabel: 'компонент MVP v1',
    title: 'Поток коммитов и приёмки',
    content_format: 'MERMAID',
    description: MERMAID_BODY,
  },
  {
    hashSeed: 'blago:story:component:bpmn:acceptance-process',
    parentHash: COMPONENT_HASH,
    parentLabel: 'компонент MVP v1',
    title: 'Процесс приёмки РИД (BPMN)',
    content_format: 'BPMN',
    description: '',
  },
  {
    hashSeed: 'blago:story:component:drawio:architecture',
    parentHash: COMPONENT_HASH,
    parentLabel: 'компонент MVP v1',
    title: 'Архитектурная схема компонентов',
    content_format: 'DRAWIO',
    description: '',
  },
  {
    hashSeed: 'blago:story:project:markdown:concept',
    parentHash: PROJECT_HASH,
    parentLabel: 'проект «Кошелёк пайщика»',
    title: 'Концепция проекта «Кошелёк пайщика»',
    content_format: 'MARKDOWN',
    description: PROJECT_CONCEPT_BODY,
  },
]

interface IStoryRow {
  story_hash: string
  title: string
  content_format: string
  project_hash?: string
}

export async function phase09b(): Promise<void> {
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

  // Подгружаем все существующие артефакты компонента и проекта — для идемпотентности.
  const existingHashes = new Set<string>()
  for (const parentHash of [COMPONENT_HASH, PROJECT_HASH]) {
    try {
      const resp = (await client.Query(Queries.Capital.GetStories.query, {
        variables: {
          filter: { coopname: COOPNAME, project_hash: parentHash },
          options: { page: 1, limit: 100 },
        } as Queries.Capital.GetStories.IInput,
      })) as Record<string, { items?: IStoryRow[] } | null>
      const out = resp[Queries.Capital.GetStories.name]
      for (const it of out?.items ?? []) existingHashes.add(it.story_hash.toLowerCase())
    } catch (e) {
      log(`Query GetStories(${parentHash.slice(0, 8)}) упал (это ок при первом запуске): ${(e as Error).message?.slice(0, 100)}`)
    }
  }

  for (const a of ARTIFACTS) {
    const story_hash = createHash('sha256').update(a.hashSeed).digest('hex')
    if (existingHashes.has(story_hash)) {
      log(`артефакт «${a.title}» уже есть (${story_hash.slice(0, 8)}…) — пропуск`)
      continue
    }
    log(`создаю артефакт «${a.title}» (${a.content_format} → ${a.parentLabel})`)
    await client.Mutation(Mutations.Capital.CreateStory.mutation, {
      variables: {
        data: {
          coopname: COOPNAME,
          story_hash,
          title: a.title,
          description: a.description,
          content_format: a.content_format,
          project_hash: a.parentHash,
        },
      } as Mutations.Capital.CreateStory.IInput,
    })
  }

  log('фаза 09b завершена')
}
