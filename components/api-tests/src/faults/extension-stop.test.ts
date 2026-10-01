/**
 * Расширение остановлено и запущено снова
 * (test-registry/documents.approvals.yaml, registration.intake-forms.yaml).
 *
 * Расширение объявляет ядру свои документы и анкеты вступления при старте.
 * Набор выключает Благорост настройкой расширения и смотрит снаружи, что из
 * реестра шаблонов кооператива и из анкет вступления ушло только его, а после
 * включения вернулось без дублей. Идёт в фазе отказов: остановка расширения
 * посреди основных наборов сломала бы чужие сценарии.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, COUNCIL, FAULTS_ENABLED, caseName, gql, tokenOf, waitFor } from '../core'
import { templates } from '../documents/docs-reports.helpers'

const EXTENSION = 'capital'
const GENERATOR_FORM = 'generator_cover_letter'

const CATALOG = 'query($d:GetExtensionsInput){ getExtensions(data:$d){ name is_installed enabled config } }'
const UPDATE = 'mutation($d:ExtensionInput!){ updateExtension(data:$d){ name enabled } }'
const CONFIG = `query($t:AccountType!,$c:String!){ getRegistrationConfig(account_type:$t, coopname:$c){
  intake_forms{ id }
  programs{ key intake_forms{ id } }
} }`

interface Snapshot {
  /** Шаблоны реестра кооператива: номер → объявившее приложение. */
  templates: Map<number, string>
  templateCount: number
  /** Общие анкеты и анкеты программ вступления. */
  commonForms: string[]
  programForms: string[]
}

describe.skipIf(!FAULTS_ENABLED)('расширение остановлено и запущено снова: декларации документов и анкет', () => {
  let chairman = ''
  let council = ''
  let extension: any
  let before: Snapshot
  let stopped: Snapshot
  let restarted: Snapshot

  async function snapshot(): Promise<Snapshot> {
    const list = await templates(council)
    const config = (await gql<any>(null, CONFIG, { t: 'individual', c: COOP })).getRegistrationConfig
    return {
      templates: new Map(list.map(t => [t.registry_id, t.extension_name])),
      templateCount: list.length,
      commonForms: (config.intake_forms as any[]).map(f => f.id as string).sort(),
      programForms: (config.programs as any[]).flatMap(p => (p.intake_forms as any[]).map(f => f.id as string)).sort(),
    }
  }

  const declaredBy = (s: Snapshot, name: string): number[] =>
    [...s.templates].filter(([, owner]) => owner === name).map(([id]) => id).sort((a, b) => a - b)

  async function setEnabled(enabled: boolean): Promise<void> {
    await gql(chairman, UPDATE, { d: { name: EXTENSION, enabled, config: extension.config ?? {} } })
  }

  beforeAll(async () => {
    chairman = await tokenOf(CHAIRMAN)
    council = await tokenOf(COUNCIL)
    const catalog = (await gql<any>(chairman, CATALOG, { d: {} })).getExtensions as any[]
    extension = catalog.find(e => e.name === EXTENSION)
    expect(extension?.is_installed && extension?.enabled, 'Благорост установлен и включён на стенде').toBe(true)
    before = await snapshot()
    expect(declaredBy(before, EXTENSION).length, 'Благорост объявил свои документы').toBeGreaterThan(0)
    expect(before.programForms, 'анкета Генератора объявлена').toContain(GENERATOR_FORM)

    await setEnabled(false)
    stopped = await waitFor(async () => {
      const s = await snapshot()
      return declaredBy(s, EXTENSION).length === 0 ? s : null
    }, { timeoutMs: 60_000, intervalMs: 1_000, label: 'деклараций остановленного расширения в реестре не осталось' })

    await setEnabled(true)
    restarted = await waitFor(async () => {
      const s = await snapshot()
      return declaredBy(s, EXTENSION).length > 0 && s.programForms.includes(GENERATOR_FORM) ? s : null
    }, { timeoutMs: 120_000, intervalMs: 1_000, label: 'запущенное расширение объявило документы и анкеты заново' })
  }, 600_000)

  afterAll(async () => {
    if (extension)
      await setEnabled(true)
  })

  it(caseName('doc.appr.side.04', 'расширение остановлено — его документы из реестра сняты, документы ядра и других приложений остались'), () => {
    expect(declaredBy(stopped, EXTENSION)).toEqual([])
    expect(declaredBy(stopped, 'core')).toEqual(declaredBy(before, 'core'))
    expect(declaredBy(stopped, 'market')).toEqual(declaredBy(before, 'market'))
    expect(stopped.templateCount).toBe(before.templateCount - declaredBy(before, EXTENSION).length)
  })

  it(caseName('doc.appr.side.06', 'расширение запущено снова и объявило те же шаблоны — записи заменены, дублей нет'), () => {
    expect(declaredBy(restarted, EXTENSION)).toEqual(declaredBy(before, EXTENSION))
    expect(restarted.templateCount, 'каждый шаблон в реестре один раз').toBe(before.templateCount)
    expect(restarted.templates.size).toBe(restarted.templateCount)
  })

  it(caseName('reg.intake.side.07', 'расширение остановлено — его анкеты сняты с реестра, остальные остались'), () => {
    expect(stopped.programForms).not.toContain(GENERATOR_FORM)
    expect(stopped.commonForms).toEqual(before.commonForms)
  })

  it(caseName('reg.intake.side.02', 'владелец регистрирует свою анкету повторно — перезапись без дубля'), () => {
    expect(restarted.programForms).toEqual(before.programForms)
    expect(restarted.programForms.filter(id => id === GENERATOR_FORM)).toHaveLength(1)
    expect(restarted.commonForms).toEqual(before.commonForms)
  })
})
