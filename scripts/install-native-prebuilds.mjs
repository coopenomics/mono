#!/usr/bin/env node
/**
 * Подкладывает нативные `.node`-бинарники из `vendor/prebuilds/` в дерево
 * `node_modules`, чтобы они никогда не собирались на машине разработчика.
 *
 * ЗАЧЕМ. Пакеты с нативной частью объявляют install-скрипт вида
 * `prebuild-install || node-gyp rebuild`: сначала попытка скачать готовый
 * бинарь, при неудаче — локальная компиляция. Фолбэк молчаливый, и вот в чём
 * беда: собранный локально бинарь линкуется с glibc ХОСТА, а исполняется он
 * внутри контейнера, куда репозиторий целиком приезжает bind-mount'ом
 * (`./:/app` в docker-compose.yaml). Совместимость glibc односторонняя —
 * старый бинарь в новой системе работает, новый в старой нет. Поэтому на
 * хосте с Ubuntu 24.04 (glibc 2.39) сборка даёт бинарь, который в контейнере
 * на Debian 12 (glibc 2.36) падает с
 *   Error: /lib/x86_64-linux-gnu/libm.so.6: version `GLIBC_2.38' not found
 *   code: 'ERR_DLOPEN_FAILED'
 * а на хосте с Ubuntu 22.04 (glibc 2.35) тот же install проходит незаметно.
 * Разработчик получает разное поведение на ровном месте, в зависимости от
 * того, докачался у него prebuild или нет.
 *
 * РЕШЕНИЕ. Официальные prebuild'ы (собранные апстримом под старую glibc)
 * лежат в репозитории, install-скрипты самих пакетов отключены через
 * `pnpm.ignoredBuiltDependencies` в корневом package.json, а этот скрипт
 * кладёт нужный файл на место после установки. Ни скачивания, ни компиляции,
 * ни зависимости от сети — установка воспроизводима и одинакова у всех.
 *
 * ПОЧЕМУ ВСЕГДА linux. Дерево `node_modules` потребляется контейнером, а не
 * хостом: на macOS/Windows разработчик всё равно запускает сервисы в docker.
 * Поэтому платформа зафиксирована как linux, а архитектура берётся с хоста
 * (Apple Silicon → arm64-контейнер → linux-arm64). Побочный эффект: на
 * macOS/Windows пакет не подгрузится в хостовом node — это ожидаемо, наши
 * сервисы там и не запускаются напрямую.
 *
 * КАК ДОБАВИТЬ ВЕРСИЮ. При бампе версии пакета положить рядом новый каталог:
 *   vendor/prebuilds/<пакет>/<версия>/linux-<arch>/<бинарь>
 * Файлы берутся из релизов апстрима, например для libxmljs2:
 *   https://github.com/marudor/libxmljs2/releases/download/v<версия>/
 *     libxmljs2-v<версия>-node-v<ABI>-linux-<arch>.tar.gz
 * ABI ноды: `node -p "process.versions.modules"` (Node 22 → 127).
 * Если каталога под установленную версию нет — скрипт падает с явным
 * сообщением, а не откатывается к тихой сборке.
 */

import { existsSync, mkdirSync, copyFileSync, chmodSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR_DIR = join(ROOT, 'vendor', 'prebuilds');
const STORE_DIR = join(ROOT, 'node_modules', '.pnpm');

/** Пакеты, чью нативную часть мы подкладываем готовой. */
const VENDORED = [
  { name: 'libxmljs2', binary: 'xmljs.node' },
];

const SUPPORTED_ARCH = new Set(['x64', 'arm64']);

/**
 * Каталоги пакета в pnpm-сторе. Имя каталога — `<пакет>@<версия>` и может
 * нести суффикс с peer-хэшем (`libxmljs2@0.37.0_foo`), поэтому версию режем
 * по первому подчёркиванию.
 */
function findInstalled(name) {
  if (!existsSync(STORE_DIR)) return [];

  return readdirSync(STORE_DIR)
    .filter((entry) => entry.startsWith(`${name}@`))
    .map((entry) => ({
      version: entry.slice(name.length + 1).split('_')[0],
      dir: join(STORE_DIR, entry, 'node_modules', name),
    }))
    .filter((pkg) => existsSync(pkg.dir));
}

function main() {
  // Установка без workspace-пакетов (например `pnpm install --filter`) может
  // вообще не притащить нативных зависимостей — это не ошибка.
  if (!existsSync(STORE_DIR)) return;

  const { arch } = process;
  if (!SUPPORTED_ARCH.has(arch)) {
    throw new Error(
      `Архитектура ${arch} не поддерживается: нативные prebuild'ы есть только для x64 и arm64.`
    );
  }

  for (const { name, binary } of VENDORED) {
    for (const { version, dir } of findInstalled(name)) {
      const source = join(VENDOR_DIR, name, version, `linux-${arch}`, binary);

      if (!existsSync(source)) {
        throw new Error(
          `Нет вендоренного бинарника для ${name}@${version} (linux-${arch}).\n` +
            `Ожидался файл: ${source}\n` +
            `Положите prebuild из релизов апстрима — см. комментарий в ${import.meta.url}.`
        );
      }

      const destDir = join(dir, 'build', 'Release');
      mkdirSync(destDir, { recursive: true });
      copyFileSync(source, join(destDir, binary));
      chmodSync(join(destDir, binary), 0o755);

      console.log(`prebuild: ${name}@${version} → linux-${arch}/${binary}`);
    }
  }
}

main();
