/**
 * Синхронизация реестра шаблонов документов с сетью.
 *
 * Локальный реестр (`Registry` из `@coopenomics/factory`) — источник истины.
 * Синхронизатор сравнивает его с таблицами `draft::drafts` / `draft::translations`
 * и приводит сеть к локальному состоянию:
 *
 * - шаблона в сети нет            → `createdraft` (версия 1);
 * - содержание разошлось          → `editdraft` (версия не меняется);
 * - перевод разошёлся             → `edittrans`;
 * - целевая версия выше сетевой   → `upversion` до целевой.
 *
 * Ничего не удаляет: шаблоны, которых нет в локальном реестре, остаются в
 * сети нетронутыми и попадают в отчёт отдельной строкой.
 *
 * Идемпотентна: второй запуск подряд не отправляет ни одной транзакции.
 *
 * Разделение «правка» / «бамп версии» — сознательное. Правка текста не должна
 * заставлять пайщиков переподписывать документ, поэтому версию поднимает
 * только явное объявление в реестре версий (`TemplateVersions` в фабрике).
 */
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

export interface IDraftsSyncOptions {
  /** Показать план и выйти, не отправляя транзакций. */
  dryRun?: boolean
}

export interface IDraftsSyncReport {
  created: number[]
  edited: number[]
  translated: number[]
  bumped: { registry_id: number, from: number, to: number }[]
  unchanged: number[]
  /** Версия в сети выше объявленной в реестре — не понижаем, только сообщаем. */
  ahead: { registry_id: number, onchain: number, declared: number }[]
  /** Есть в сети, но нет в локальном реестре — не трогаем. */
  orphans: number[]
  /** Шаблон объявляет переводы, которые синхронизатор поставить не может. */
  skippedLangs: { registry_id: number, langs: string[] }[]
  failed: { registry_id: number, error: string }[]
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
  translation: string
  langs: string[]
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

    // Шаблон без перевода на язык по умолчанию поставить нечем: перевод
    // создаётся одним действием с шаблоном и обязателен.
    if (!template.translations?.[DEFAULT_LANG])
      throw new Error(`Шаблон ${registry_id} не содержит перевода «${DEFAULT_LANG}»`)

    drafts.push({
      registry_id,
      title: template.title,
      description: template.description,
      context: template.context,
      model: JSON.stringify(template.model),
      translation: JSON.stringify(template.translations[DEFAULT_LANG]),
      langs: Object.keys(template.translations),
      version: getTemplateVersion(registry_id),
    })
  }

  return drafts.sort((a, b) => a.registry_id - b.registry_id)
}

export async function syncDrafts(
  blockchain: Blockchain,
  options: IDraftsSyncOptions = {},
): Promise<IDraftsSyncReport> {
  const dryRun = options.dryRun === true

  const report: IDraftsSyncReport = {
    created: [],
    edited: [],
    translated: [],
    bumped: [],
    unchanged: [],
    ahead: [],
    orphans: [],
    skippedLangs: [],
    failed: [],
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
  for (const row of onchainTranslations)
    translationsById.set(Number(row.id), row)

  const localDrafts = collectLocalDrafts()
  const localIds = new Set(localDrafts.map(d => d.registry_id))

  console.log(
    `Реестр документов: локально ${localDrafts.length}, в сети ${onchainDrafts.length}`,
  )
  if (dryRun)
    console.log('Режим проверки: транзакции не отправляются')

  for (const local of localDrafts) {
    const onchain = draftsById.get(local.registry_id)

    // Единственный перевод, который синхронизатор умеет ставить — тот, что
    // создаётся вместе с шаблоном. Отдельное действие createtrans в контракте
    // заводит пустую строку (не заполняет ни draft_id, ни lang, ни data),
    // поэтому вторым языком тут управлять нечем.
    const extraLangs = local.langs.filter(lang => lang !== DEFAULT_LANG)
    if (extraLangs.length > 0)
      report.skippedLangs.push({ registry_id: local.registry_id, langs: extraLangs })

    try {
      if (!onchain) {
        console.log(`[${local.registry_id}] создаю шаблон «${local.title}»`)

        if (!dryRun) {
          await blockchain.createDraft({
            scope: SCOPE,
            username: SYSTEM_ACCOUNT,
            registry_id: local.registry_id,
            lang: DEFAULT_LANG,
            title: local.title,
            description: local.description,
            context: local.context,
            model: local.model,
            translation_data: local.translation,
          })
        }

        report.created.push(local.registry_id)

        // Свежесозданный шаблон всегда версии 1 — доводим до объявленной.
        await raiseVersion(blockchain, local.registry_id, 1, local.version, dryRun, report)
        continue
      }

      let touched = false

      const contentChanged
        = onchain.title !== local.title
          || onchain.description !== local.description
          || onchain.context !== local.context
          || onchain.model !== local.model

      if (contentChanged) {
        console.log(`[${local.registry_id}] обновляю содержание`)

        if (!dryRun) {
          await blockchain.editDraft({
            scope: SCOPE,
            username: SYSTEM_ACCOUNT,
            registry_id: local.registry_id,
            title: local.title,
            description: local.description,
            context: local.context,
            model: local.model,
          })
        }

        report.edited.push(local.registry_id)
        touched = true
      }

      const translationId = Number(onchain.default_translation_id)
      const onchainTranslation = translationsById.get(translationId)
      let translationBroken = false

      if (!onchainTranslation) {
        // Шаблон есть, а перевода по его default_translation_id нет — чинить
        // нечем: createtrans в контракте не заполняет строку. Сообщаем.
        translationBroken = true
        report.failed.push({
          registry_id: local.registry_id,
          error: `перевод ${translationId} не найден в сети`,
        })
      }
      else if (onchainTranslation.data !== local.translation) {
        console.log(`[${local.registry_id}] обновляю перевод ${translationId}`)

        if (!dryRun) {
          await blockchain.editTranslation({
            scope: SCOPE,
            username: SYSTEM_ACCOUNT,
            translate_id: translationId,
            data: local.translation,
          })
        }

        report.translated.push(local.registry_id)
        touched = true
      }

      const versionChanged = await raiseVersion(
        blockchain,
        local.registry_id,
        Number(onchain.version),
        local.version,
        dryRun,
        report,
      )

      if (!touched && !versionChanged && !translationBroken)
        report.unchanged.push(local.registry_id)
    }
    catch (error: any) {
      const message = error?.message ?? String(error)
      console.error(`[${local.registry_id}] ошибка: ${message}`)
      report.failed.push({ registry_id: local.registry_id, error: message })
    }
  }

  for (const row of onchainDrafts) {
    const registry_id = Number(row.registry_id)
    if (!localIds.has(registry_id))
      report.orphans.push(registry_id)
  }

  printReport(report)

  return report
}

/**
 * Доводит версию шаблона в сети до объявленной. Возвращает `true`, если
 * версия менялась. Понижение невозможно — только сообщение в отчёт.
 */
async function raiseVersion(
  blockchain: Blockchain,
  registry_id: number,
  from: number,
  to: number,
  dryRun: boolean,
  report: IDraftsSyncReport,
): Promise<boolean> {
  if (to === from)
    return false

  if (to < from) {
    report.ahead.push({ registry_id, onchain: from, declared: to })
    return false
  }

  console.log(`[${registry_id}] поднимаю версию ${from} → ${to} (потребуется переподписание)`)

  if (!dryRun) {
    for (let version = from; version < to; version++) {
      // Пауза между одинаковыми действиями обязательна: тело транзакции
      // не меняется, и без смены опорного блока сеть отклонит вторую как
      // дубликат по идентификатору.
      if (version > from)
        await sleep(1000)

      await blockchain.upVersion({
        scope: SCOPE,
        username: SYSTEM_ACCOUNT,
        registry_id,
      })
    }
  }

  report.bumped.push({ registry_id, from, to })

  return true
}

function printReport(report: IDraftsSyncReport): void {
  console.log('--- Итог синхронизации реестра документов ---')
  console.log(`создано:        ${report.created.length}${format(report.created)}`)
  console.log(`обновлено:      ${report.edited.length}${format(report.edited)}`)
  console.log(`переводов:      ${report.translated.length}${format(report.translated)}`)
  console.log(`версий поднято: ${report.bumped.length}${
    report.bumped.length ? ` (${report.bumped.map(b => `${b.registry_id}: ${b.from}→${b.to}`).join(', ')})` : ''
  }`)
  console.log(`без изменений:  ${report.unchanged.length}`)

  if (report.ahead.length > 0) {
    console.log(
      `версия в сети выше объявленной: ${report.ahead
        .map(a => `${a.registry_id} (в сети ${a.onchain}, объявлено ${a.declared})`)
        .join(', ')}`,
    )
  }

  if (report.orphans.length > 0)
    console.log(`в сети, но не в реестре (не тронуты): ${report.orphans.join(', ')}`)

  if (report.skippedLangs.length > 0) {
    console.log(
      `переводы вне «${DEFAULT_LANG}» не синхронизируются: ${report.skippedLangs
        .map(s => `${s.registry_id} (${s.langs.join(', ')})`)
        .join(', ')}`,
    )
  }

  if (report.failed.length > 0) {
    console.log('ОШИБКИ:')
    for (const failure of report.failed)
      console.log(`  [${failure.registry_id}] ${failure.error}`)
  }
}

function format(ids: number[]): string {
  return ids.length > 0 ? ` (${ids.join(', ')})` : ''
}
