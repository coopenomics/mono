// Фазы подготовки стенда, заявленные сценарием в `meta.prepare`.
//
// Формат спецификации — `<группа>:<фаза>`, например `marketplace:01-l1-accept`.
// Группа резолвится в components/boot/src/scripts/seed-<группа>/index.ts,
// фаза уходит туда аргументом. Каждая фаза идемпотентна: повторный прогон без
// reboot — no-op, поэтому объявлять их можно щедро.
//
// Зачем это отдельным слоем, а не шагами внутри сценария: подготовка часто
// многоактовая и не имеет отношения к проверяемому экрану (принятие ЦПП
// советом — это голоса троих и протокол председателя). Загоняя её в сценарий,
// мы бы проверяли платформенный онбординг вместо Стола заказов и роняли UI-тест
// по причинам, к интерфейсу не относящимся.
//
// Вынесено из bin/shoot.mjs: те же фазы нужны сюите (bin/run-marketplace-all.mjs).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(HARNESS_ROOT, '../..');

// .env репозитория содержит host-порты конкретного чекаута (mono-ai-4 —
// цепь :8918, mongo :27047, postgres :5562). boot/.env настроен на адреса
// внутри docker-сети и для host-запуска seed-скриптов не годится.
function readRootEnv() {
  const out = {};
  const file = path.join(REPO_ROOT, '.env');
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  // Сид ходит в controller по GraphQL; порт берём из того же .env.
  if (out.COOPBACK_HOST_PORT && !out.CONTROLLER_GRAPHQL_URL) {
    out.CONTROLLER_GRAPHQL_URL = `http://127.0.0.1:${out.COOPBACK_HOST_PORT}/v1/graphql`;
  }
  return out;
}

/**
 * Прогоняет список спецификаций фаз. Бросает на первой упавшей: продолжать
 * прогон на недоготовленном стенде бессмысленно — падения пойдут лавиной и
 * скроют исходную причину.
 */
export function runPrepare(specs, { log = () => {} } = {}) {
  if (!Array.isArray(specs) || specs.length === 0) return [];
  const env = { ...process.env, ...readRootEnv() };
  const done = [];

  for (const spec of specs) {
    const m = String(spec).match(/^([\w-]+):([\w-]+)$/);
    if (!m) throw new Error(`prepare: не понимаю спецификацию «${spec}» (формат: <группа>:<фаза>)`);
    const [, group, phase] = m;
    const scriptPath = `src/scripts/seed-${group}/index.ts`;
    if (!fs.existsSync(path.join(REPO_ROOT, 'components/boot', scriptPath))) {
      throw new Error(`prepare: нет seed-группы «${group}» (${scriptPath})`);
    }
    log(`prepare ${spec}`);
    const r = spawnSync(
      'pnpm',
      ['--filter', '@coopenomics/boot', 'exec', 'esno', scriptPath, phase],
      { cwd: REPO_ROOT, stdio: 'inherit', env }
    );
    if (r.status !== 0) throw new Error(`prepare ${spec} провалилась`);
    done.push(spec);
  }
  return done;
}

/** Спецификации фаз, объявленные сценариями плана, в порядке первого появления. */
export async function collectPrepare(scenarios) {
  const specs = [];
  for (const scenario of scenarios) {
    const file = path.join(HARNESS_ROOT, 'scenarios', `${scenario}.mjs`);
    if (!fs.existsSync(file)) continue;
    try {
      const mod = await import(`file://${file}`);
      for (const s of mod.meta?.prepare ?? []) if (!specs.includes(s)) specs.push(s);
    } catch {
      // Сценарий, который не импортируется, упадёт со своей ошибкой в прогоне —
      // здесь его молча пропускаем, чтобы не подменять причину.
    }
  }
  return specs;
}
