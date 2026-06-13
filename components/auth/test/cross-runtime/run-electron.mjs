/**
 * Лаунчер electron-таргета (Story 9.13): резолвит бинарь electron, проверяет
 * наличие dist (smoke идёт против собранного артефакта), на безголовом хосте
 * заворачивает запуск в `xvfb-run -a` (electron на Linux требует X-сервер).
 * `--no-sandbox` — для контейнерных/CI-окружений без user namespaces.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import electronPath from 'electron'

const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(here, '..', '..')

if (!existsSync(join(pkgRoot, 'dist', 'index.cjs'))) {
  console.error('[electron-smoke] dist/index.cjs не найден — сначала `pnpm build` (test:cross-runtime делает это сам)')
  process.exit(1)
}

const electronArgs = ['--no-sandbox', join(here, 'electron-main.cjs')]
const needXvfb = process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY

const [cmd, args] = needXvfb
  ? ['xvfb-run', ['-a', electronPath, ...electronArgs]]
  : [electronPath, electronArgs]

const res = spawnSync(cmd, args, { stdio: 'inherit', cwd: pkgRoot })

if (res.error) {
  console.error(`[electron-smoke] не удалось запустить ${cmd}: ${res.error.message}`)
  process.exit(1)
}
process.exit(res.status ?? 1)
