#!/usr/bin/env node
/**
 * Полнота эталонов (шаг 0 фабрики v2, компонент 71).
 *
 * У каждого вида документа из `src/Actions/<номер>.<Имя>.ts` обязан быть хотя
 * бы один снимок в `test/golden/<номер>/`. Скрипт запускается в CI после
 * набора тестов и падает со списком видов без эталона: такой документ
 * рефакторинг мог бы изменить незаметно.
 *
 * Запуск: node scripts/golden-coverage.mjs [--report <файл.json>]
 */
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const actionsDir = join(root, 'src', 'Actions')
const goldenDir = join(root, 'test', 'golden')

const reportArg = process.argv.indexOf('--report')
const reportFile = reportArg > 0 ? process.argv[reportArg + 1] : null

const kinds = readdirSync(actionsDir)
  .map(name => name.match(/^(\d+)\.([A-Za-z]+)\.ts$/))
  .filter(Boolean)
  .map(m => ({ registry_id: Number(m[1]), name: m[2] }))
  .sort((a, b) => a.registry_id - b.registry_id)

const rows = kinds.map((kind) => {
  const dir = join(goldenDir, String(kind.registry_id))
  const snapshots = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.html')).length : 0
  return { ...kind, snapshots }
})

const missing = rows.filter(r => r.snapshots === 0)
const covered = rows.length - missing.length

console.log(`Видов документов: ${rows.length}, с эталоном: ${covered}, без эталона: ${missing.length}`)
for (const row of missing)
  console.log(`  нет эталона: ${row.registry_id} ${row.name}`)

if (reportFile)
  writeFileSync(reportFile, `${JSON.stringify({ total: rows.length, covered, missing, rows }, null, 2)}\n`)

if (missing.length > 0)
  process.exit(1)
