/**
 * Синхронизация реестра шаблонов документов с сетью.
 *
 * Локальный реестр (`Registry` из `@coopenomics/factory`) — источник истины.
 * Сравнение с таблицами `draft::drafts` / `draft::translations` даёт план:
 *
 * - шаблона в сети нет            → `createdraft` (версия 1);
 * - содержание разошлось          → `editdraft` (версия не меняется);
 * - перевод разошёлся             → `edittrans`;
 * - перевода на язык нет          → `createtrans`;
 * - целевая версия выше сетевой   → `upversion` до целевой.
 *
 * Ничего не удаляет: шаблоны, которых нет в локальном реестре, остаются в
 * сети нетронутыми и попадают в отчёт отдельной строкой. Идемпотентно:
 * второй запуск подряд даёт пустой план.
 *
 * Разделение «правка» / «бамп версии» — сознательное. Правка текста не должна
 * заставлять пайщиков переподписывать документ, поэтому версию поднимает
 * только явное объявление в реестре версий (`TemplateVersions` в фабрике).
 *
 * План отделён от применения, потому что подписывать транзакции в раскатке
 * сети некому: ключ системного аккаунта живёт в кошельке `cleos`-контейнера
 * плейбука и стирается вместе с ним. Поэтому в раскатке план считает этот
 * код (сети нужно только чтение), а подписывает и отправляет `cleos` из
 * того же контейнера, что деплоит контракты — см. {@link writeDraftsPlan}.
 * Прямое применение ({@link applyDraftsPlan}) остаётся для локальной цепи,
 * где ключ и так в конфиге.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Registry, getTemplateVersion } from '@coopenomics/factory'
import { DraftContract } from 'cooptypes'
import type Blockchain from '../blockchain'
import { sleep } from '../utils'

/** Область памяти реестра платформенных шаблонов. */
const SCOPE = DraftContract.contractName.production
/** Платформенные шаблоны правит системный аккаунт. */
const SYSTEM_ACCOUNT = 'eosio'
/** Язык перевода, который создаётся вместе с шаблоном. */
const DEFAULT_LANG = 'ru'
/** Размер страницы при вычитывании таблиц: строки крупные (контекст документа). */
const PAGE_SIZE = 20

const ACTIONS = {
  createDraft: DraftContract.Actions.CreateDraft.actionName,
  editDraft: DraftContract.Actions.EditDraft.actionName,
  createTranslation: DraftContract.Actions.CreateTranslation.actionName,
  editTranslation: DraftContract.Actions.EditTranslation.actionName,
  upVersion: DraftContract.Actions.UpVersion.actionName,
} as const

export type TDraftActionName = typeof ACTIONS[keyof typeof ACTIONS]

export interface IPlannedAction {
  /** Имя действия контракта `draft`. */
  action: TDraftActionName
  registry_id: number
  /** Человекочитаемое пояснение — идёт в лог применения. */
  reason: string
  /** Данные действия ровно в том виде, в каком уходят в сеть. */
  data: Record<string, unknown>
}

export interface IDraftsPlan {
  actions: IPlannedAction[]
  created: number[]
  edited: number[]
  translated: number[]
  translationsCreated: { registry_id: number, lang: string }[]
  bumped: { registry_id: number, from: number, to: number }[]
  unchanged: number[]
  /** Версия в сети выше объявленной в реестре — не понижаем, только сообщаем. */
  ahead: { registry_id: number, onchain: number, declared: number }[]
  /** Есть в сети, но нет в локальном реестре — не трогаем. */
  orphans: number[]
  /** Расхождения, которые синхронизатор починить не может. */
  problems: { registry_id: number, error: string }[]
}

interface IOnchainDraft {
  registry_id: number | string
  version: number | string
  default_translation_id: number | string
  title: string
  description: string
  context: string
  model: string
}

interface IOnchainTranslation {
  id: number | string
  draft_id: number | string
  lang: string
  data: string
}

/** Локальное состояние шаблона в том виде, в каком оно ложится в сеть. */
interface ILocalDraft {
  registry_id: number
  title: string
  description: string
  context: string
  model: string
  /** Переводы по языкам, уже сериализованные. */
  translations: Record<string, string>
  version: number
}

async function fetchAllRows<T>(blockchain: Blockchain, table: string): Promise<T[]> {
  const rows: T[] = []
  let lower_bound: string | undefined

  for (;;) {
    const result = await blockchain.api.rpc.get_table_rows({
      json: true,
      code: SCOPE,
      scope: SCOPE,
      table,
      limit: PAGE_SIZE,
      lower_bound,
    })

    rows.push(...(result.rows as T[]))

    // next_key пустой при more=true означает, что дальше листать нечем —
    // выходим, чтобы не крутить бесконечный цикл на старых нодах.
    if (!result.more || !result.next_key)
      break

    lower_bound = result.next_key
  }

  return rows
}

/** Разворачивает локальный реестр в плоский список того, что должно быть в сети. */
function collectLocalDrafts(): ILocalDraft[] {
  const drafts: ILocalDraft[] = []

  for (const id in Registry) {
    const registry_id = Number(id)
    const template = Registry[id as unknown as keyof typeof Registry].Template

    // Часть шаблонов обходится без словаря перевода — в их контексте нет ни
    // одного `{% trans %}`. Для таких перевод по умолчанию пустой: строка
    // перевода всё равно заводится вместе с шаблоном и должна существовать.
    const translations: Record<string, string> = {
      [DEFAULT_LANG]: JSON.stringify(template.translations?.[DEFAULT_LANG] ?? {}),
    }
    for (const lang of Object.keys(template.translations ?? {}))
      translations[lang] = JSON.stringify(template.translations[lang])

    drafts.push({
      registry_id,
      title: template.title,
      description: template.description,
      context: template.context,
      model: JSON.stringify(template.model),
      translations,
      version: getTemplateVersion(registry_id),
    })
  }

  return drafts.sort((a, b) => a.registry_id - b.registry_id)
}

/**
 * Считает, что нужно сделать с реестром в сети. Только чтение — ключи не нужны.
 */
export async function computeDraftsPlan(blockchain: Blockchain): Promise<IDraftsPlan> {
  const plan: IDraftsPlan = {
    actions: [],
    created: [],
    edited: [],
    translated: [],
    translationsCreated: [],
    bumped: [],
    unchanged: [],
    ahead: [],
    orphans: [],
    problems: [],
  }

  const onchainDrafts = await fetchAllRows<IOnchainDraft>(
    blockchain,
    DraftContract.Tables.Drafts.tableName,
  )
  const onchainTranslations = await fetchAllRows<IOnchainTranslation>(
    blockchain,
    DraftContract.Tables.Translations.tableName,
  )

  const draftsById = new Map<number, IOnchainDraft>()
  for (const row of onchainDrafts)
    draftsById.set(Number(row.registry_id), row)

  const translationsById = new Map<number, IOnchainTranslation>()
  const translationsByLang = new Map<string, IOnchainTranslation>()
  for (const row of onchainTranslations) {
    translationsById.set(Number(row.id), row)
    translationsByLang.set(`${Number(row.draft_id)}:${row.lang}`, row)
  }

  const localDrafts = collectLocalDrafts()
  const localIds = new Set(localDrafts.map(d => d.registry_id))

  console.log(
    `Реестр документов: локально ${localDrafts.length}, в сети ${onchainDrafts.length}`,
  )

  for (const local of localDrafts) {
    const onchain = draftsById.get(local.registry_id)

    if (!onchain) {
      plan.actions.push({
        action: ACTIONS.createDraft,
        registry_id: local.registry_id,
        reason: `создание шаблона «${local.title}»`,
        data: {
          scope: SCOPE,
          username: SYSTEM_ACCOUNT,
          registry_id: local.registry_id,
          lang: DEFAULT_LANG,
          title: local.title,
          description: local.description,
          context: local.context,
          model: local.model,
          translation_data: local.translations[DEFAULT_LANG],
        },
      })
      plan.created.push(local.registry_id)

      // Перевод по умолчанию заводится вместе с шаблоном, остальные — отдельно.
      for (const lang of Object.keys(local.translations)) {
        if (lang !== DEFAULT_LANG)
          planCreateTranslation(plan, local, lang)
      }

      // Свежесозданный шаблон всегда версии 1 — доводим до объявленной.
      planVersion(plan, local.registry_id, 1, local.version)
      continue
    }

    let touched = false

    const contentChanged
      = onchain.title !== local.title
        || onchain.description !== local.description
        || onchain.context !== local.context
        || onchain.model !== local.model

    if (contentChanged) {
      plan.actions.push({
        action: ACTIONS.editDraft,
        registry_id: local.registry_id,
        reason: 'обновление содержания',
        data: {
          scope: SCOPE,
          username: SYSTEM_ACCOUNT,
          registry_id: local.registry_id,
          title: local.title,
          description: local.description,
          context: local.context,
          model: local.model,
        },
      })
      plan.edited.push(local.registry_id)
      touched = true
    }

    for (const lang of Object.keys(local.translations)) {
      // Строка перевода ищется по паре «шаблон + язык»; для языка по умолчанию
      // подстраховываемся ссылкой из самого шаблона.
      const existing = translationsByLang.get(`${local.registry_id}:${lang}`)
        ?? (lang === DEFAULT_LANG
          ? translationsById.get(Number(onchain.default_translation_id))
          : undefined)

      if (!existing) {
        planCreateTranslation(plan, local, lang)
        touched = true
        continue
      }

      if (existing.data !== local.translations[lang]) {
        plan.actions.push({
          action: ACTIONS.editTranslation,
          registry_id: local.registry_id,
          reason: `обновление перевода «${lang}»`,
          data: {
            scope: SCOPE,
            username: SYSTEM_ACCOUNT,
            translate_id: Number(existing.id),
            data: local.translations[lang],
          },
        })
        plan.translated.push(local.registry_id)
        touched = true
      }
    }

    const versionChanged = planVersion(
      plan,
      local.registry_id,
      Number(onchain.version),
      local.version,
    )

    if (!touched && !versionChanged)
      plan.unchanged.push(local.registry_id)
  }

  for (const row of onchainDrafts) {
    const registry_id = Number(row.registry_id)
    if (!localIds.has(registry_id))
      plan.orphans.push(registry_id)
  }

  return plan
}

function planCreateTranslation(plan: IDraftsPlan, local: ILocalDraft, lang: string): void {
  plan.actions.push({
    action: ACTIONS.createTranslation,
    registry_id: local.registry_id,
    reason: `создание перевода «${lang}»`,
    data: {
      scope: SCOPE,
      username: SYSTEM_ACCOUNT,
      registry_id: local.registry_id,
      lang,
      data: local.translations[lang],
    },
  })
  plan.translationsCreated.push({ registry_id: local.registry_id, lang })
}

/**
 * Дописывает в план подъём версии до объявленной. Возвращает `true`, если
 * версия меняется. Понижение невозможно — только сообщение в отчёт.
 */
function planVersion(plan: IDraftsPlan, registry_id: number, from: number, to: number): boolean {
  if (to === from)
    return false

  if (to < from) {
    plan.ahead.push({ registry_id, onchain: from, declared: to })
    return false
  }

  for (let version = from; version < to; version++) {
    plan.actions.push({
      action: ACTIONS.upVersion,
      registry_id,
      reason: `подъём версии ${version} → ${version + 1} (потребуется переподписание)`,
      data: {
        scope: SCOPE,
        username: SYSTEM_ACCOUNT,
        registry_id,
      },
    })
  }

  plan.bumped.push({ registry_id, from, to })

  return true
}

/**
 * Применяет план напрямую через ключи в конфиге. Используется на локальной
 * цепи (`boot`) — в раскатке сети подписывает `cleos`, см. {@link writeDraftsPlan}.
 */
export async function applyDraftsPlan(blockchain: Blockchain, plan: IDraftsPlan): Promise<void> {
  for (const planned of plan.actions) {
    console.log(`[${planned.registry_id}] ${planned.reason}`)

    // Повторный подъём версии одного шаблона даёт побайтово одинаковую
    // транзакцию: без смены опорного блока сеть отклонит её как дубликат.
    if (planned.action === ACTIONS.upVersion)
      await sleep(1000)

    switch (planned.action) {
      case ACTIONS.createDraft:
        await blockchain.createDraft(planned.data as any)
        break
      case ACTIONS.editDraft:
        await blockchain.editDraft(planned.data as any)
        break
      case ACTIONS.createTranslation:
        await blockchain.createTranslation(planned.data as any)
        break
      case ACTIONS.editTranslation:
        await blockchain.editTranslation(planned.data as any)
        break
      case ACTIONS.upVersion:
        await blockchain.upVersion(planned.data as any)
        break
    }
  }
}

/**
 * Раскладывает план на диск: данные каждого действия отдельным JSON-файлом и
 * скрипт `apply.sh`, который проталкивает их через `cleos`.
 *
 * Так ключ системного аккаунта остаётся там, где он и был — в кошельке
 * контейнера, который деплоит контракты и который плейбук стирает следом.
 */
export async function writeDraftsPlan(plan: IDraftsPlan, outDir: string): Promise<void> {
  const actionsDir = join(outDir, 'actions')
  await mkdir(actionsDir, { recursive: true })

  const lines: string[] = [
    '#!/bin/bash',
    '# Сгенерировано `drafts:sync --plan` из реестра шаблонов документов.',
    '# Подписывает и отправляет cleos кошельком того контейнера, где запущен.',
    '#',
    '# Окружение: CLEOS_URL — endpoint ноды.',
    'set -euo pipefail',
    '',
    'CLEOS_URL="${CLEOS_URL:?не задан CLEOS_URL}"',
    'DIR="$(cd "$(dirname "$0")" && pwd)"',
    '',
    'push() {',
    '  local action="$1" file="$2" label="$3"',
    '  echo "--- $label"',
    `  cleos -u "$CLEOS_URL" push action ${SCOPE} "$action" "$(cat "$DIR/actions/$file")" -p ${SYSTEM_ACCOUNT}@active`,
    '}',
    '',
  ]

  if (plan.actions.length === 0) {
    lines.push('echo "Реестр документов уже соответствует релизу — изменений нет."', 'exit 0', '')
  }
  else {
    lines.push(`echo "Действий к применению: ${plan.actions.length}"`, '')

    plan.actions.forEach((planned, index) => {
      const file = `${String(index + 1).padStart(4, '0')}.${planned.action}.${planned.registry_id}.json`
      lines.push(`push ${planned.action} ${file} "[${planned.registry_id}] ${planned.reason}"`)

      // Повторные upversion одного шаблона побайтово совпадают — разносим их
      // по разным опорным блокам, иначе вторая транзакция отбивается дублем.
      if (planned.action === ACTIONS.upVersion)
        lines.push('sleep 1')
    })

    lines.push('', 'echo "Реестр документов приведён к релизу."', '')
  }

  await Promise.all(
    plan.actions.map((planned, index) => {
      const file = `${String(index + 1).padStart(4, '0')}.${planned.action}.${planned.registry_id}.json`
      return writeFile(join(actionsDir, file), JSON.stringify(planned.data), 'utf8')
    }),
  )

  await writeFile(join(outDir, 'apply.sh'), lines.join('\n'), { mode: 0o755 })
  await writeFile(join(outDir, 'plan.json'), JSON.stringify(plan, null, 2), 'utf8')

  console.log(`План разложен в ${outDir}: действий ${plan.actions.length}`)
}

export function printDraftsPlan(plan: IDraftsPlan): void {
  console.log('--- План синхронизации реестра документов ---')
  console.log(`создать:        ${plan.created.length}${format(plan.created)}`)
  console.log(`обновить:       ${plan.edited.length}${format(plan.edited)}`)
  console.log(`переводов:      ${plan.translated.length}${format(plan.translated)}`)

  if (plan.translationsCreated.length > 0) {
    console.log(
      `создать переводов: ${plan.translationsCreated.length} (${plan.translationsCreated
        .map(t => `${t.registry_id}:${t.lang}`)
        .join(', ')})`,
    )
  }

  console.log(`версий поднять: ${plan.bumped.length}${
    plan.bumped.length ? ` (${plan.bumped.map(b => `${b.registry_id}: ${b.from}→${b.to}`).join(', ')})` : ''
  }`)
  console.log(`без изменений:  ${plan.unchanged.length}`)
  console.log(`всего действий: ${plan.actions.length}`)

  if (plan.ahead.length > 0) {
    console.log(
      `версия в сети выше объявленной: ${plan.ahead
        .map(a => `${a.registry_id} (в сети ${a.onchain}, объявлено ${a.declared})`)
        .join(', ')}`,
    )
  }

  if (plan.orphans.length > 0)
    console.log(`в сети, но не в реестре (не тронуты): ${plan.orphans.join(', ')}`)

  if (plan.problems.length > 0) {
    console.log('ПРОБЛЕМЫ:')
    for (const problem of plan.problems)
      console.log(`  [${problem.registry_id}] ${problem.error}`)
  }
}

/**
 * Полный цикл для локальной цепи: посчитать план и применить его своими ключами.
 */
export async function syncDrafts(blockchain: Blockchain): Promise<IDraftsPlan> {
  const plan = await computeDraftsPlan(blockchain)
  printDraftsPlan(plan)
  await applyDraftsPlan(blockchain, plan)

  return plan
}

function format(ids: number[]): string {
  return ids.length > 0 ? ` (${ids.join(', ')})` : ''
}
