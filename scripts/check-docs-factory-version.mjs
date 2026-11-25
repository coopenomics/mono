#!/usr/bin/env node
/**
 * Версии фабрики и шаблонов документов в монорепозитории (решения 7 и 15 PRD
 * компонента 71).
 *
 * Фабрика (`@coopenomics/docs-factory`) и шаблоны (`@coopenomics/docs-templates`)
 * живут в отдельном репозитории `C9S/docs-factory`, выходят одной версией и
 * ставятся из npm. Версию поднимает робот выпуска PR-ом; гейт держит правила,
 * которые иначе легко нарушить руками:
 *
 *   1. версия точная — без `^`, `~`, диапазонов и `workspace:`: обновление
 *      проходит только через PR робота с проверкой монорепозитория;
 *   2. версия каждого пакета одна у всех пакетов монорепозитория;
 *   3. фабрика и шаблоны одной версии — шаблон и сборщик совпадают;
 *   4. подключённый локальный чекаут (`pnpm factory:link` — `link:`/`file:`
 *      в зависимости или в `pnpm.overrides`) не коммитится.
 *
 * Запуск: node scripts/check-docs-factory-version.mjs
 */
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const NAMES = ['@coopenomics/docs-factory', '@coopenomics/docs-templates']
const EXACT = /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/

const files = execSync('git ls-files "package.json" "**/package.json"', { cwd: root })
  .toString()
  .trim()
  .split('\n')
  .filter(f => f && !f.includes('node_modules'))

const problems = []
/** Имя пакета → (файл → версия). */
const versions = new Map(NAMES.map(n => [n, new Map()]))

for (const file of files) {
  const pkg = JSON.parse(readFileSync(join(root, file), 'utf8'))
  for (const name of NAMES) {
    for (const field of ['dependencies', 'devDependencies']) {
      const spec = pkg[field]?.[name]
      if (spec === undefined)
        continue
      if (!EXACT.test(spec))
        problems.push(`${file}: ${name} «${spec}» — нужна точная версия из npm (её ставит PR робота выпуска фабрики)`)
      versions.get(name).set(file, spec)
    }
    const override = pkg.pnpm?.overrides?.[name]
    if (override !== undefined)
      problems.push(`${file}: pnpm.overrides подменяет ${name} на «${override}» — локальный чекаут не коммитится, выполните pnpm factory:unlink`)
  }
}

const single = {}
for (const [name, byFile] of versions) {
  const distinct = new Set(byFile.values())
  if (distinct.size > 1) {
    const list = [...byFile].map(([f, v]) => `${f}=${v}`).join(', ')
    problems.push(`${name} объявлен разными версиями: ${list} — версия одна на весь монорепозиторий`)
  }
  if (distinct.size === 1)
    single[name] = [...distinct][0]
}
const [factory, templates] = NAMES.map(n => single[n])
if (factory && templates && factory !== templates)
  problems.push(`фабрика ${factory} и шаблоны ${templates} разных версий — пакеты выходят одной версией, поднимает их PR робота`)

if (problems.length) {
  console.error(`Версии фабрики и шаблонов документов:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
for (const [name, byFile] of versions) {
  console.log(byFile.size
    ? `${name} ${single[name]} — в ${byFile.size} пакетах, точная, без подмены`
    : `${name} в монорепозитории не объявлен`)
}
