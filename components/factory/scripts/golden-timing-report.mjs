#!/usr/bin/env node
/**
 * Сводка времени сборки документов по замерам набора тестов (NFR5 фабрики v2).
 *
 * Вход — JSONL-файл, который пишет `test/utils/golden.ts` при заданном
 * GOLDEN_TIMING_FILE: по строке `{ registry_id, case, ms }` на сборку.
 * Выход — таблица по видам документов и общие медиана и 95-й процентиль.
 * Это исходный уровень до рефакторинга: с ним сравнивается каждый шаг.
 *
 * Запуск: node scripts/golden-timing-report.mjs <файл.jsonl> [--json <сводка.json>]
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [input] = process.argv.slice(2)
if (!input) {
  console.error('Укажите файл замеров JSONL')
  process.exit(2)
}
const jsonArg = process.argv.indexOf('--json')
const jsonFile = jsonArg > 0 ? process.argv[jsonArg + 1] : null

const samples = readFileSync(input, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map(line => JSON.parse(line))

function percentile(values, p) {
  if (values.length === 0)
    return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, index)]
}

const byKind = new Map()
for (const s of samples) {
  const list = byKind.get(s.registry_id) ?? []
  list.push(s.ms)
  byKind.set(s.registry_id, list)
}

const rows = [...byKind.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([registry_id, ms]) => ({
    registry_id,
    samples: ms.length,
    median_ms: Math.round(percentile(ms, 50)),
    p95_ms: Math.round(percentile(ms, 95)),
    max_ms: Math.round(Math.max(...ms)),
  }))

const all = samples.map(s => s.ms)
const summary = {
  samples: all.length,
  kinds: rows.length,
  median_ms: Math.round(percentile(all, 50)),
  p95_ms: Math.round(percentile(all, 95)),
  rows,
}

console.log(`Сборок: ${summary.samples}, видов: ${summary.kinds}, медиана: ${summary.median_ms} мс, p95: ${summary.p95_ms} мс`)
console.log('registry_id\tсборок\tмедиана мс\tp95 мс\tмакс мс')
for (const r of rows)
  console.log(`${r.registry_id}\t${r.samples}\t${r.median_ms}\t${r.p95_ms}\t${r.max_ms}`)

if (jsonFile)
  writeFileSync(jsonFile, `${JSON.stringify(summary, null, 2)}\n`)
