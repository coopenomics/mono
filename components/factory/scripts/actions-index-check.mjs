#!/usr/bin/env node
/**
 * Полнота экспорта сборщиков (шаг 4 фабрики v2).
 *
 * Реестр сборщиков собирается из экспортов `src/Actions/index.ts`. Файл
 * сборщика без строки экспорта в реестр не попадёт, и документ не соберётся;
 * строка без файла уронит сборку. Скрипт сверяет каталог и индекс в обе
 * стороны и падает со списком расхождений.
 *
 * Запуск: node scripts/actions-index-check.mjs
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'src', 'Actions')

const files = readdirSync(dir)
  .filter(name => /^\d+\.[A-Za-z]+\.ts$/.test(name))
  .map(name => name.replace(/\.ts$/, ''))

const index = readFileSync(join(dir, 'index.ts'), 'utf8')
const exported = [...index.matchAll(/from '\.\/([^']+)'/g)].map(m => m[1])

const missing = files.filter(f => !exported.includes(f))
const dangling = exported.filter(e => !files.includes(e))

console.log(`Файлов сборщиков: ${files.length}, строк экспорта: ${exported.length}`)
for (const f of missing)
  console.log(`  нет строки экспорта в src/Actions/index.ts: ${f}`)
for (const e of dangling)
  console.log(`  строка экспорта без файла: ${e}`)

if (missing.length > 0 || dangling.length > 0)
  process.exit(1)
