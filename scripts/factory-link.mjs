#!/usr/bin/env node
/**
 * Подключить к монорепозиторию локальный чекаут фабрики и шаблонов документов
 * и вернуть версии из npm (решения 7 и 15 PRD компонента 71).
 *
 *   pnpm factory:link     — `@coopenomics/docs-factory` и `@coopenomics/docs-templates`
 *                           из соседнего чекаута (DOCS_FACTORY_DIR, по умолчанию
 *                           ~/docs-factory; шаблоны — его packages/docs-templates);
 *                           правка видна контроллеру после `pnpm build` пакета
 *   pnpm factory:unlink   — вернуть версии из npm, объявленные в package.json
 *
 * Подмена пишется в `pnpm.overrides` корневого package.json и ставится
 * `pnpm install`. Закоммитить её не даст гейт `pnpm check`
 * (scripts/check-docs-factory-version.mjs): подключённый чекаут — только для
 * работы на своей машине или стенде.
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const NAME = '@coopenomics/docs-factory'
const TEMPLATES = '@coopenomics/docs-templates'
const mode = process.argv[2]
const pkgPath = join(root, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

if (mode === 'link') {
  const dir = resolve(process.env.DOCS_FACTORY_DIR || join(homedir(), 'docs-factory'))
  if (!existsSync(join(dir, 'package.json')) || JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).name !== NAME) {
    console.error(`В ${dir} нет чекаута ${NAME}. Клонируйте C9S/docs-factory или задайте DOCS_FACTORY_DIR.`)
    process.exit(1)
  }
  pkg.pnpm ??= {}
  pkg.pnpm.overrides ??= {}
  pkg.pnpm.overrides[NAME] = `link:${dir}`
  pkg.pnpm.overrides[TEMPLATES] = `link:${join(dir, 'packages', 'docs-templates')}`
  console.log(`${NAME}, ${TEMPLATES} → ${dir}. Перед проверкой соберите шаблоны, затем фабрику: (cd ${dir}/packages/docs-templates && pnpm build) && (cd ${dir} && pnpm build).`)
}
else if (mode === 'unlink') {
  if (pkg.pnpm?.overrides?.[NAME] === undefined && pkg.pnpm?.overrides?.[TEMPLATES] === undefined) {
    console.log(`${NAME} и ${TEMPLATES} не подменены — ставятся версии из npm.`)
    process.exit(0)
  }
  delete pkg.pnpm.overrides[NAME]
  delete pkg.pnpm.overrides[TEMPLATES]
  if (Object.keys(pkg.pnpm.overrides).length === 0)
    delete pkg.pnpm.overrides
  console.log(`${NAME} и ${TEMPLATES} возвращены на версии из npm.`)
}
else {
  console.error('Использование: node scripts/factory-link.mjs link|unlink')
  process.exit(2)
}

writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
execSync('pnpm install', { cwd: root, stdio: 'inherit' })
