import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const PACKAGE_NAME = '@coopenomics/controller';

let cached: string | undefined;

/**
 * Версия запущенного контроллера — `version` его package.json (CalVer, её
 * поднимает lerna одним числом для всех пакетов релиза).
 *
 * package.json ищется вверх от файла: в разработке код запускается из `src/`,
 * в образе — из `dist/src/`, и относительный путь у них разный. Не нашли —
 * `unknown`: версия нужна для журнала и сообщений об ошибках, ронять из-за неё
 * запуск нельзя.
 */
export function appVersion(): string {
  if (cached) return cached;
  let dir = __dirname;
  for (let depth = 0; depth < 6; depth++) {
    const file = join(dir, 'package.json');
    if (existsSync(file)) {
      try {
        const pkg = JSON.parse(readFileSync(file, 'utf8')) as { name?: string; version?: string };
        if (pkg.name === PACKAGE_NAME && pkg.version) return (cached = pkg.version);
      } catch {
        // битый package.json по пути вверх — ищем дальше
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return (cached = 'unknown');
}
