#!/usr/bin/env node
/**
 * Заморозка выпущенных версий сборщиков (фабрика v2, шаг 7; FR28–FR29).
 *
 * Версия сборщика, однажды выпущенная, не правится: документы этой версии
 * пересобираются ею же, и любая правка её кода меняет старые документы.
 * Исправление ошибки — новый `minor` отдельным файлом рядом
 * (`<номер>.<Имя>_v1_1.ts`, `version: '1.1'`), со своими эталонами.
 *
 * Замок `test/golden/builders.lock.json`: для каждой версии `<номер>@<версия>`
 * — файл и SHA-256 его кода. Хэш считается без строк импорта и реэкспорта,
 * без комментариев и без различий в пробелах: перенос шаблонов в другой пакет
 * (шаг 6б) меняет только пути импорта, а смысл кода — нет. Проверка падает, если:
 *   - код замороженной версии изменился;
 *   - замороженная версия исчезла (документы этой версии нечем пересобрать);
 *   - появилась версия без записи в замке.
 * Вывод замороженной версии держат эталоны (`test/golden`): правка общих
 * помощников, меняющая документ, роняет их.
 *
 * Запуск:
 *   node scripts/builders-freeze-check.mjs            — проверка (CI, workflow Factory)
 *   node scripts/builders-freeze-check.mjs --update   — дописать НОВЫЕ версии в замок;
 *                                                      записи замороженных не меняет
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const actionsDir = join(root, 'src', 'Actions')
const lockPath = join(root, 'test', 'golden', 'builders.lock.json')
const update = process.argv.includes('--update')

/** Код сборщика без импортов, комментариев и различий в пробелах. */
function codeOf(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => !/^\s*(import\s|export\s+(\*|\{[^}]*\})\s+from\s)/.test(line))
    .map(line => line.replace(/(^|[^:'"`])\/\/.*$/, '$1'))
    .join(' ')
    // Пробелы не несут смысла: схлопываются, у знаков препинания убираются.
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}()[\],:;=<>+\-*/?.|&!])\s*/g, '$1')
    .trim()
}

/** Версии сборщиков по файлам `src/Actions`: ключ `<номер>@<версия>`. */
const found = {}
const problems = []
for (const name of readdirSync(actionsDir).filter(n => /^\d+\.[A-Za-z0-9_]+\.ts$/.test(n)).sort()) {
  const id = name.split('.')[0]
  const content = readFileSync(join(actionsDir, name), 'utf8')
  const versions = [...content.matchAll(/^\s*version:\s*'(\d+\.\d+)',?\s*$/gm)].map(m => m[1])
  if (versions.length !== 1) {
    problems.push(`${name}: ожидалось одно объявление version: 'M.m', найдено ${versions.length}`)
    continue
  }
  const key = `${id}@${versions[0]}`
  if (found[key]) {
    problems.push(`${name}: версия ${key} уже объявлена в ${found[key].file}`)
    continue
  }
  found[key] = { file: `src/Actions/${name}`, sha256: createHash('sha256').update(codeOf(content)).digest('hex') }
}

const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, 'utf8')) : {}

for (const [key, frozen] of Object.entries(lock)) {
  const now = found[key]
  if (!now)
    problems.push(`${key}: замороженная версия исчезла (${frozen.file}) — документы этой версии нечем пересобрать`)
  else if (now.sha256 !== frozen.sha256)
    problems.push(`${key}: код ${now.file} изменён, а версия заморожена — заведите новый minor отдельным файлом`)
}

const fresh = Object.keys(found).filter(key => !lock[key])

if (update) {
  if (problems.length) {
    console.error(`Замок не обновлён — сначала исправьте:\n  ${problems.join('\n  ')}`)
    process.exit(1)
  }
  const next = { ...lock }
  for (const key of fresh)
    next[key] = found[key]
  const sorted = Object.fromEntries(Object.keys(next).sort((a, b) => {
    const [ia, va] = a.split('@')
    const [ib, vb] = b.split('@')
    return Number(ia) - Number(ib) || va.localeCompare(vb, undefined, { numeric: true })
  }).map(k => [k, next[k]]))
  writeFileSync(lockPath, `${JSON.stringify(sorted, null, 2)}\n`)
  console.log(`Замок версий сборщиков: добавлено ${fresh.length}, всего ${Object.keys(sorted).length}`)
  process.exit(0)
}

for (const key of fresh)
  problems.push(`${key}: новая версия без записи в замке — node scripts/builders-freeze-check.mjs --update, вместе с эталонами версии`)

if (problems.length) {
  console.error(`Заморозка версий сборщиков нарушена:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`Заморозка версий сборщиков: ${Object.keys(lock).length} версий, изменений нет`)
