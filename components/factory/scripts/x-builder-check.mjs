#!/usr/bin/env node
/**
 * Ключ `x-builder` редакции шаблона (фабрика v2, шаг 7; решение 6 PRD).
 *
 * Редакция шаблона объявляет ключом `x-builder` в поле `model`, под какой
 * `major` сборщика написан её текст (нет ключа — `1`). Смена `major` — смена
 * формы модели, а значит новая редакция: `upversion` в цепи и утверждение
 * советом каждого кооператива. Поменять `x-builder` внутри действующей
 * редакции (через `editdraft` раскатки `drafts:sync`) нельзя: кооперативы на
 * этой редакции молча получили бы другую форму документа без решения совета.
 *
 * Замок `test/golden/x-builder.lock.json`: для каждого шаблона — номер
 * редакции (`src/Templates/versions.ts`) и объявленный `major`. Проверка
 * падает, если:
 *   - `x-builder` изменился, а номер редакции тот же;
 *   - номер редакции изменился, а замок не обновлён (правка видна в ревью);
 *   - объявленному `major` нет ни одной версии сборщика в `src/Actions`;
 *   - шаблона нет в замке.
 *
 * Читает собранный пакет (`dist`), поэтому в CI идёт после сборки фабрики.
 *
 * Запуск:
 *   node scripts/x-builder-check.mjs            — проверка
 *   node scripts/x-builder-check.mjs --update   — записать редакции и major в замок;
 *                                                 смену major без новой редакции не пишет
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const lockPath = join(root, 'test', 'golden', 'x-builder.lock.json')
const update = process.argv.includes('--update')

// Сборка CommonJS: ESM-сборка тянет ajv-i18n импортом каталога, который
// Node в режиме ESM не разрешает.
const pkg = createRequire(import.meta.url)(join(root, 'dist', 'index.cjs'))
const { Registry, getTemplateVersion, templateBuilderMajor } = pkg

/** `major` версий сборщиков по номеру реестра — из объявлений в src/Actions. */
const majors = {}
for (const name of readdirSync(join(root, 'src', 'Actions')).filter(n => /^\d+\.[A-Za-z0-9_]+\.ts$/.test(n))) {
  const id = name.split('.')[0]
  const content = readFileSync(join(root, 'src', 'Actions', name), 'utf8')
  for (const m of content.matchAll(/^\s*version:\s*'(\d+)\.\d+',?\s*$/gm))
    (majors[id] ??= new Set()).add(Number(m[1]))
}

const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, 'utf8')) : {}
const next = {}
const problems = []

for (const [id, entry] of Object.entries(Registry)) {
  let major
  try {
    major = templateBuilderMajor(entry.Template.model)
  }
  catch (e) {
    problems.push(`${id}: ${e.message}`)
    continue
  }
  const edition = getTemplateVersion(id)
  next[id] = { edition, major }

  if (!majors[id]?.has(major))
    problems.push(`${id}: редакция ${edition} объявляет x-builder ${major}, а версии сборщика ${major}.x в src/Actions нет`)

  const locked = lock[id]
  if (!locked) {
    if (!update)
      problems.push(`${id}: шаблона нет в замке — node scripts/x-builder-check.mjs --update`)
    continue
  }
  if (locked.edition === edition && locked.major !== major)
    problems.push(`${id}: x-builder изменён с ${locked.major} на ${major} внутри редакции ${edition} — смена major требует новой редакции (versions.ts, upversion, утверждение советом)`)
  else if (locked.edition !== edition && !update)
    problems.push(`${id}: редакция ${locked.edition} → ${edition}, замок не обновлён — node scripts/x-builder-check.mjs --update`)
}

if (problems.length) {
  console.error(`Проверка x-builder не пройдена:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}

if (update) {
  const sorted = Object.fromEntries(Object.keys(next).sort((a, b) => Number(a) - Number(b)).map(k => [k, next[k]]))
  writeFileSync(lockPath, `${JSON.stringify(sorted, null, 2)}\n`)
  console.log(`Замок x-builder: ${Object.keys(sorted).length} шаблонов записано`)
  process.exit(0)
}
console.log(`x-builder: ${Object.keys(next).length} шаблонов, смен внутри редакции нет`)
