#!/usr/bin/env node
/**
 * Версия фабрики документов в монорепозитории (решение 15 PRD компонента 71).
 *
 * Фабрика (`@coopenomics/docs-factory`) живёт в отдельном репозитории
 * `C9S/docs-factory` и ставится из npm. Её версию поднимает робот выпуска
 * фабрики PR-ом; гейт держит три правила, которые иначе легко нарушить руками:
 *
 *   1. версия точная — без `^`, `~`, диапазонов и `workspace:`: обновление
 *      проходит только через PR робота с проверкой монорепозитория;
 *   2. версия одна у всех пакетов монорепозитория, где фабрика объявлена;
 *   3. подключённый локальный чекаут (`pnpm factory:link` — `link:`/`file:`
 *      в зависимости или в `pnpm.overrides`) не коммитится.
 *
 * Запуск: node scripts/check-docs-factory-version.mjs
 */
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const NAME = '@coopenomics/docs-factory'
const EXACT = /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/

const files = execSync('git ls-files "package.json" "**/package.json"', { cwd: root })
  .toString()
  .trim()
  .split('\n')
  .filter(f => f && !f.includes('node_modules'))

const problems = []
const versions = new Map()

for (const file of files) {
  const pkg = JSON.parse(readFileSync(join(root, file), 'utf8'))
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const spec = pkg[field]?.[NAME]
    if (spec === undefined)
      continue
    if (field === 'peerDependencies')
      continue
    if (!EXACT.test(spec))
      problems.push(`${file}: ${NAME} «${spec}» — нужна точная версия из npm (её ставит PR робота выпуска фабрики)`)
    versions.set(file, spec)
  }
  const override = pkg.pnpm?.overrides?.[NAME]
  if (override !== undefined)
    problems.push(`${file}: pnpm.overrides подменяет ${NAME} на «${override}» — локальный чекаут не коммитится, выполните pnpm factory:unlink`)
}

const distinct = new Set(versions.values())
if (distinct.size > 1) {
  const list = [...versions].map(([f, v]) => `${f}=${v}`).join(', ')
  problems.push(`${NAME} объявлен разными версиями: ${list} — версия одна на весь монорепозиторий`)
}

if (problems.length) {
  console.error(`Версия фабрики документов:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(versions.size
  ? `${NAME} ${[...distinct][0]} — в ${versions.size} пакетах, точная, без подмены`
  : `${NAME} в монорепозитории не объявлен`)
