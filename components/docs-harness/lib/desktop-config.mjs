// Генерация components/desktop/public/config.js для SPA-dev.
//
// Зачем. Рантайм-конфиг фронта (`window.__APP_CONFIG__`) в проде отдаёт SSR
// middleware `generateConfig.ts`. Но dev-контейнер desktop поднят как
// `quasar dev --mode spa`, где middlewares не работают: запрос на /config.js
// получает SPA-fallback (index.html), Environment.ts это распознаёт по
// content-type и уходит на резервный `public/config.default.js`. А там жёстко
// зашиты BACKEND_URL=:2998 и CHAIN_URL=:8888 — адреса СОСЕДНЕГО стенда
// (mono-ai-1). На mono-ai-4 (:3028 / :8918) фронт стучится не туда, system
// info не грузится, coopname не резолвится, и роутер падает с
// «Missing required param "coopname"» — белая страница вместо приложения.
//
// public/ Vite отдаёт статикой, поэтому положенный туда config.js
// перехватывается раньше fallback'а и чинит SPA-dev без перезапуска desktop.
//
// Файл НЕ коммитится (см. components/desktop/.gitignore): в проде
// serveStatic отдал бы его раньше SSR-middleware, и на всех окружениях
// оказался бы чужой dev-конфиг.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Осторожно: экспорт REPO_ROOT из harness.mjs указывает на components/,
// а не на корень репозитория. Считаем путь от себя, чтобы не наступить.
const DESKTOP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../desktop');

// Набор ключей — ровно тот, что отдаёт generateConfig.ts (EnvVars).
const KEYS = [
  'NODE_ENV', 'BACKEND_URL', 'CHAIN_URL', 'CHAIN_ID', 'CURRENCY',
  'COOP_SHORT_NAME', 'SITE_DESCRIPTION', 'SITE_IMAGE', 'STORAGE_URL',
  'UPLOAD_URL', 'TIMEZONE', 'VUE_ROUTER_MODE', 'VUE_ROUTER_BASE',
  'VAPID_PUBLIC_KEY', 'SENTRY_DSN', 'OPENREPLAY_PROJECT_KEY',
  'YANDEX_MAPS_API_KEY',
];

function parseEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

// Значения — строки из .env; ключи взяты из KEYS и все являются валидными
// идентификаторами, поэтому кавычек не требуют. Пишем в стиле
// public/config.default.js (одинарные кавычки), а не JSON.stringify: иначе
// vite-plugin-checker показывал бы оверлей `quotes` поверх приложения, пока
// файл не попал в .eslintignore.
function jsString(value) {
  const escaped = String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n');
  return `'${escaped}'`;
}

/**
 * Пишет public/config.js по components/desktop/.env.
 * Возвращает {written, config} — written=false если файл уже актуален
 * (лишняя запись дёргала бы HMR на каждом прогоне сценария).
 */
export function ensureDesktopConfig() {
  const env = parseEnv(path.join(DESKTOP, '.env'));
  const config = {};
  for (const k of KEYS) if (env[k] !== undefined) config[k] = env[k];
  config.TIMEZONE = config.TIMEZONE || 'Europe/Moscow';

  const entries = Object.entries(config)
    .map(([key, value]) => `  ${key}: ${jsString(value)},\n`)
    .join('');

  const body =
    '// Сгенерировано docs-harness (lib/desktop-config.mjs) из components/desktop/.env.\n' +
    '// Нужен только для SPA-dev, где SSR middleware generateConfig не работает.\n' +
    '// Не коммитить: в проде перехватил бы реальный /config.js.\n' +
    `window.__APP_CONFIG__ = {\n${entries}};\n`;

  const target = path.join(DESKTOP, 'public/config.js');
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  if (current === body) return { written: false, config, path: target };

  fs.writeFileSync(target, body);
  return { written: true, config, path: target };
}
