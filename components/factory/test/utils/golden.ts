/**
 * Эталоны сборки документов (шаг 0 фабрики v2, компонент 71).
 *
 * Каждая сборка документа в наборе тестов оставляет три снимка в
 * `test/golden/<registry_id>/<имя случая>.*`:
 *
 *  - `.html`       — HTML документа, то, что подписывает пайщик после перехода
 *                    на подлинник HTML и что сегодня идёт в WeasyPrint;
 *  - `.meta.json`  — метаданные документа без версии пакета: она меняется
 *                    каждым выпуском и не относится к сборке;
 *  - `.pdf.sha256` — хэш PDF. Сверяется только при GOLDEN_PDF=1: PDF зависит
 *                    от WeasyPrint и шрифтов машины, поэтому его сверяет CI,
 *                    где они закреплены так же, как в образе контроллера.
 *
 * Снимки создаются прогоном vitest с `-u` (режим обновления) и коммитятся.
 * Без `-u` отсутствующий снимок в CI — ошибка: так ловится документ, который
 * никто не заморозил. Расхождение со снимком — ошибка рефакторинга: вывод
 * старого документа изменился.
 *
 * Имя случая берётся из имени теста (vitest `currentTestName`), поэтому один
 * тест с несколькими сборками одного документа получает порядковый суффикс.
 * Русские имена оставлены как есть: снимок должен читаться человеком.
 *
 * Время сборки каждого документа пишется в `GOLDEN_TIMING_FILE` (JSONL):
 * замер исходной скорости до рефакторинга, NFR5.
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { expect } from 'vitest'
import type { IGeneratedDocument } from '../../src'

/** Корень снимков — рядом с тестами, попадает в git. */
export const GOLDEN_DIR = join(__dirname, '..', 'golden')

/**
 * Дата документа для снимков. Новая сборка без `created_at` берёт текущий
 * момент, и снимок плыл бы от прогона к прогону; `testDocumentGeneration`
 * подставляет эту дату, когда тест свою не задал.
 */
export const GOLDEN_CREATED_AT = '2026-10-28T09:00:00.000Z'

/**
 * Версия генератора в мете снимков. По умолчанию это версия пакета, она
 * впечатывается в PDF и меняется каждым выпуском монорепозитория; 28.10.2026
 * выпуск сдвинул хэши PDF у 103 снимков из 107 при равном HTML.
 */
export const GOLDEN_VERSION = 'golden'

/** Версия пакета в мете заменяется меткой: выпуск не меняет сборку. */
const VERSION_PLACEHOLDER = '<package-version>'

/** Счётчик сборок внутри одного теста: `имя-теста`, `имя-теста-2`, … */
const casesPerTest = new Map<string, number>()

function caseName(registryId: number): string {
  const testName = expect.getState().currentTestName ?? 'без-теста'
  // Имя файла: буквы и цифры любого алфавита, остальное — дефис.
  const slug = testName
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)
  const key = `${registryId}/${slug}`
  const n = (casesPerTest.get(key) ?? 0) + 1
  casesPerTest.set(key, n)
  return n === 1 ? slug : `${slug}-${n}`
}

function normalizeMeta(meta: IGeneratedDocument['meta']): Record<string, unknown> {
  return { ...meta, version: VERSION_PLACEHOLDER }
}

function recordTiming(registryId: number, name: string, ms: number) {
  const file = process.env.GOLDEN_TIMING_FILE
  if (!file)
    return
  mkdirSync(dirname(file), { recursive: true })
  appendFileSync(file, `${JSON.stringify({ registry_id: registryId, case: name, ms })}\n`)
}

/**
 * Сверяет документ с эталоном (или создаёт эталон в режиме `-u`).
 * `elapsedMs` — время `generator.generate` для замера скорости.
 */
export async function matchGolden(document: IGeneratedDocument, elapsedMs: number): Promise<void> {
  const registryId = document.meta.registry_id
  const name = caseName(registryId)
  const base = join(GOLDEN_DIR, String(registryId), name)

  recordTiming(registryId, name, elapsedMs)

  await expect(document.html).toMatchFileSnapshot(`${base}.html`)
  await expect(`${JSON.stringify(normalizeMeta(document.meta), null, 2)}\n`).toMatchFileSnapshot(`${base}.meta.json`)

  // `hash` документа — SHA-256 его PDF (формат подписи 1.x).
  if (process.env.GOLDEN_PDF === '1')
    await expect(`${document.hash}\n`).toMatchFileSnapshot(`${base}.pdf.sha256`)
}
