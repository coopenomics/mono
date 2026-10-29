/**
 * Версия сборщика (шаг 7 фабрики v2, решение 6 PRD).
 *
 * Две независимые оси. Редакция шаблона — юридический текст в цепи: её номер
 * поднимает `upversion`, совет каждого кооператива утверждает её сам. Версия
 * сборщика — код, две части `major.minor`:
 *
 * - `major` меняется, когда меняется форма модели: поле удалено,
 *   переименовано, сменило смысл. Смена `major` — только вместе с новой
 *   редакцией шаблона (`upversion` и утверждение советом).
 * - `minor` — исправление ошибки или новое поле без удаления. Выходит с
 *   раскаткой бэкенда, без правки цепи и без решения совета.
 *
 * Редакция объявляет только `major` ключом `x-builder` в поле `model` (нет
 * ключа — `1`). Новая сборка берёт последний `minor` объявленного `major`,
 * который есть на узле; пересборка — точную версию из `meta.builder`;
 * документ без `meta.builder` (собран до оси версий) — версию `1.0`.
 *
 * Выпущенная версия заморожена: её файл и её вывод не меняются (проверки
 * `scripts/builders-freeze-check.mjs` и эталоны). Исправление — новый `minor`
 * отдельным файлом рядом.
 */
export type BuilderVersion = `${number}.${number}`

/** Версия, которой собраны все документы до оси версий. */
export const FIRST_BUILDER_VERSION: BuilderVersion = '1.0'

/** Ключ в схеме `model` редакции шаблона: под какой `major` написан текст. */
export const X_BUILDER_KEY = 'x-builder'

export interface IBuilderVersionParts {
  major: number
  minor: number
}

const VERSION_RE = /^(\d+)\.(\d+)$/

export function parseBuilderVersion(version: string): IBuilderVersionParts {
  const match = VERSION_RE.exec(version)
  if (!match)
    throw new Error(`Версия сборщика «${version}» не в виде major.minor`)
  const major = Number(match[1])
  const minor = Number(match[2])
  if (major < 1)
    throw new Error(`Версия сборщика «${version}»: major начинается с 1`)
  return { major, minor }
}

export function isBuilderVersion(value: unknown): value is BuilderVersion {
  return typeof value === 'string' && VERSION_RE.test(value)
}

/** `major`, объявленный редакцией шаблона; ключа нет — `1`. */
export function templateBuilderMajor(model: unknown): number {
  const declared = (model as Record<string, unknown> | null | undefined)?.[X_BUILDER_KEY]
  if (declared === undefined || declared === null)
    return 1
  if (typeof declared !== 'number' || !Number.isInteger(declared) || declared < 1)
    throw new Error(`Ключ ${X_BUILDER_KEY} в схеме шаблона — целое число от 1, получено ${JSON.stringify(declared)}`)
  return declared
}

/** Последний `minor` заданного `major` среди версий; нет ни одной — `undefined`. */
export function latestMinorOf(versions: Iterable<string>, major: number): BuilderVersion | undefined {
  let best: IBuilderVersionParts | undefined
  for (const v of versions) {
    const parts = parseBuilderVersion(v)
    if (parts.major === major && (!best || parts.minor > best.minor))
      best = parts
  }
  return best ? `${best.major}.${best.minor}` as BuilderVersion : undefined
}
