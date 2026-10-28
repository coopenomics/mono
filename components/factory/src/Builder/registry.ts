/**
 * Реестр сборщиков (шаг 4 фабрики v2, FR16–FR17).
 *
 * Раньше `Generator.connect` держал таблицу из 92 строк «номер реестра →
 * new Factory(storage)», и новый документ требовал правки таблицы. Теперь
 * реестр собирается из экспортов `src/Actions`: каждый модуль отдаёт `Factory`
 * (класс из `defineBuilder`) и `Template` (пространство шаблона с номером
 * реестра). Новый документ — файл сборщика и строка экспорта в
 * `src/Actions/index.ts`; полноту экспорта держит `scripts/actions-index-check.mjs`.
 *
 * Расхождения ловятся при старте, а не при первой сборке: два сборщика на
 * один номер, номер объявления не равен номеру шаблона, шаблон реестра без
 * сборщика или сборщик без шаблона.
 */
import type { DocFactory } from '../Factory'
import type { IGenerate } from '../Interfaces/Documents'
import type { MongoDBConnector } from '../Services/Databazor'
import { Registry as Templates } from '../Templates/registry'

/** Модуль сборщика: класс фабрики и пространство шаблона с номером реестра. */
export interface IBuilderModule {
  Factory: new (storage: MongoDBConnector) => DocFactory<IGenerate>
  Template: { registry_id: number }
}

function isBuilderModule(value: unknown): value is IBuilderModule {
  if (!value || typeof value !== 'object')
    return false
  const m = value as Partial<IBuilderModule>
  return typeof m.Factory === 'function' && typeof m.Template?.registry_id === 'number'
}

/**
 * Собирает фабрики по номеру реестра из модулей `Actions`.
 * Бросает ошибку с перечнем всех расхождений сразу, чтобы чинить за один раз.
 */
export function buildFactories(modules: Record<string, unknown>, storage: MongoDBConnector): Record<number, DocFactory<IGenerate>> {
  const factories: Record<number, DocFactory<IGenerate>> = {}
  const problems: string[] = []

  for (const [name, module] of Object.entries(modules)) {
    if (!isBuilderModule(module)) {
      problems.push(`${name}: модуль не экспортирует Factory и Template.registry_id`)
      continue
    }
    const id = module.Template.registry_id
    if (factories[id]) {
      problems.push(`${name}: номер реестра ${id} уже занят другим сборщиком`)
      continue
    }
    const factory = new module.Factory(storage)
    const declared = (factory as { spec?: { registry_id?: number } }).spec?.registry_id
    if (declared !== undefined && declared !== id)
      problems.push(`${name}: объявление сборщика ${declared} не совпадает с номером шаблона ${id}`)
    factories[id] = factory
  }

  const templateIds = Object.keys(Templates).map(Number)
  for (const id of templateIds) {
    if (!factories[id])
      problems.push(`шаблон ${id} есть в реестре шаблонов, сборщика для него нет`)
  }
  for (const id of Object.keys(factories).map(Number)) {
    if (!templateIds.includes(id))
      problems.push(`сборщик ${id} есть, шаблона ${id} в реестре шаблонов нет`)
  }

  if (problems.length > 0)
    throw new Error(`Реестр сборщиков собран с ошибками:\n  ${problems.join('\n  ')}`)

  return factories
}
