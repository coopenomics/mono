// Где искать текст в коде и где лежат словари.
//
// Одно место правды для гейта `check-i18n.mjs` и инструмента переноса
// `i18n-extract.mjs`. Словари разложены по потребителям: у desktop и у
// controller свой сводный словарь, общий для обоих — пакет @coopenomics/i18n.

import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

/** Каталоги с кодом интерфейса и сообщениями для пользователя. */
export const SCAN_ROOTS = [
  { root: 'components/desktop/src', exts: ['.vue', '.ts', '.js'] },
  { root: 'components/desktop/extensions', exts: ['.vue', '.ts', '.js'] },
  { root: 'components/desktop/src-ssr', exts: ['.ts', '.js'] },
  { root: 'components/desktop/src-pwa', exts: ['.ts', '.js'] },
  { root: 'components/controller/src', exts: ['.ts'] },
  { root: 'components/extension-kit/src', exts: ['.ts'] },
  { root: 'components/notifications/src', exts: ['.ts'] },
  { root: 'components/auth/src', exts: ['.ts'] },
  { root: 'components/sdk/src', exts: ['.ts'] },
];

/** Что не сканируется: тесты, миграции, сгенерированное, страницы разработчика. */
export const SCAN_EXCLUDE = [
  /\/node_modules\//,
  /\/dist\//,
  /\/zeus\//,
  /\.d\.ts$/,
  /\.(test|spec|e2e)\.[cm]?[tj]s$/,
  /\/(tests?|__tests__|__mocks__|e2e|migrations)\//,
  /__lintbase__/,
  /\.generated\.ts$/,
  /components\/desktop\/src\/pages\/_dev\//,
];

export function listScanFiles() {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  for (const { root, exts } of SCAN_ROOTS) {
    const abs = join(REPO_ROOT, root);
    if (!existsSync(abs)) continue;
    const before = out.length;
    walk(abs);
    // отфильтровать только что добавленные по расширению
    const added = out.splice(before).filter((f) => exts.some((e) => f.endsWith(e)));
    out.push(...added);
  }
  return out
    .map((f) => relative(REPO_ROOT, f))
    .filter((rel) => !SCAN_EXCLUDE.some((re) => re.test('/' + rel)))
    .sort();
}

/** Пакет, к которому относится файл, — для сводки долга. */
export function packageOf(rel) {
  const m = /^components\/([^/]+)\/(?:(extensions|src\/extensions)\/([^/]+)\/)?/.exec(rel);
  if (!m) return rel;
  return m[3] ? `${m[1]}:${m[3]}` : m[1];
}

// ─── словари ────────────────────────────────────────────────────────────────

const I18N_PKG = 'components/i18n/src/messages';
const DESKTOP_CORE = 'components/desktop/src/shared/i18n/locales';
const DESKTOP_EXT = 'components/desktop/extensions';
const CONTROLLER_CORE = 'components/controller/src/i18n/locales';
const CONTROLLER_EXT = 'components/controller/src/extensions';

function jsonFilesIn(dir) {
  const abs = join(REPO_ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => join(dir, f));
}

function extensionDictionaries(root, locale) {
  const abs = join(REPO_ROOT, root);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((name) => existsSync(join(abs, name, 'i18n', `${locale}.json`)))
    .sort()
    .map((name) => ({ file: join(root, name, 'i18n', `${locale}.json`), extension: name }));
}

/**
 * Словари потребителя по языку: [{ file, extension? }]. Расширение обязано
 * держать все ключи под своим именем (camelCase имени каталога) и коды ошибок
 * с префиксом своего имени.
 */
export function dictionariesOf(app, locale = 'ru') {
  const shared = jsonFilesIn(join(I18N_PKG, locale)).map((file) => ({ file }));
  if (app === 'desktop') {
    return [
      ...shared,
      ...jsonFilesIn(join(DESKTOP_CORE, locale)).map((file) => ({ file })),
      ...extensionDictionaries(DESKTOP_EXT, locale),
    ];
  }
  if (app === 'controller') {
    return [
      ...shared,
      ...jsonFilesIn(join(CONTROLLER_CORE, locale)).map((file) => ({ file })),
      ...extensionDictionaries(CONTROLLER_EXT, locale),
    ];
  }
  throw new Error(`неизвестный потребитель словарей: ${app}`);
}

/** Какому потребителю принадлежит файл кода (для проверки ключей). */
export function appOf(rel) {
  // Клиентские библиотеки переводятся словарями пакета — они входят в словарь desktop.
  if (rel.startsWith('components/desktop/') || /^components\/(auth|sdk)\//.test(rel)) return 'desktop';
  if (/^components\/(controller|extension-kit|notifications)\//.test(rel)) return 'controller';
  return undefined;
}

/** `soviet-robot` → `sovietRobot` — имя пространства ключей расширения. */
export function extensionNamespace(dirName) {
  return dirName.replace(/[-_]+([a-z0-9])/g, (_, c) => c.toUpperCase());
}

/** Куда генерируются типы ключей потребителя. */
export const KEY_TYPES = {
  desktop: 'components/desktop/src/shared/i18n/keys.generated.ts',
  controller: 'components/controller/src/i18n/keys.generated.ts',
};

export const HARDCODE_BASELINE = 'scripts/lib/i18n-hardcode-baseline.json';
export const GLOSSARY = 'components/i18n/glossary.json';
