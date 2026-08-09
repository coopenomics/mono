#!/usr/bin/env node
/**
 * Сюита UI-тестов Стола заказов: `pnpm test:ui:marketplace`.
 *
 * Порядок не косметический. Сценарии необратимо двигают состояние цепи
 * (предложение → заказ → отгрузка → приёмка → выдача → возврат → списание),
 * поэтому сюита — это ещё и сквозной E2E прямого пути: каждая следующая
 * группа опирается на состояние, созданное предыдущей.
 *
 *   node bin/run-marketplace-all.mjs                  прогон на текущем стенде
 *   node bin/run-marketplace-all.mjs --reboot         с reboot:extra (чистая цепь)
 *   node bin/run-marketplace-all.mjs --only=orderer/catalog,orderer/orders
 *   node bin/run-marketplace-all.mjs --from=operator/warehouse   продолжить с места
 *
 * Сюита НЕ входит в `pnpm test` и не вызывается из release.yaml: прогон
 * требует поднятого стека и живёт минутами, а не секундами. Запуск — только
 * явной командой либо workflow_dispatch.
 *
 * Падение одного сценария не останавливает остальные: в конце печатается
 * сводка и пишется shots/_suite/summary.json, а код возврата ненулевой,
 * если хоть что-то красное.
 */
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureDesktopConfig } from '../lib/desktop-config.mjs';
import { ensureFixture, fixturesOfScenario } from '../lib/fixtures.mjs';
import { collectPrepare, runPrepare } from '../lib/prepare.mjs';

const HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(HARNESS_ROOT, '../..');

// ── Порядок прогона ────────────────────────────────────────────────────────
// Группы отражают цепочку состояния, а не разбивку по ролям: роль внутри
// шага меняется (поставщик подписывает акт, потом председатель КУ его
// закрывает), и сортировка по столам разорвала бы процесс.

const GROUPS = [
  {
    name: 'L1 — кооператив подключает Стол заказов',
    scenarios: [
      'marketplace/onboarding/install-market',
      'marketplace/onboarding/coop-accept-cpp',
      'marketplace/chairman/branches',
      'marketplace/chairman/category-whitelist',
    ],
  },
  {
    name: 'L3 — гейт первого входа',
    // Строго ДО сценариев заказчика: там пайщик подписывает ЦПП, и гейт
    // после этого не воспроизводится.
    scenarios: [
      'marketplace/onboarding/member-pick-cpp',
      'marketplace/onboarding/extension-gate',
    ],
  },
  {
    name: 'Предложение поставщика и его модерация',
    scenarios: [
      'marketplace/offerer/offer-create',
      'marketplace/chairman/offer-moderation',
      'marketplace/offerer/my-offers',
    ],
  },
  {
    name: 'Заказ',
    scenarios: [
      'marketplace/orderer/catalog',
      'marketplace/orderer/order-create',
      'marketplace/orderer/orders',
      'marketplace/orderer/orders-empty',
      'marketplace/orderer/consolidated',
    ],
  },
  {
    name: 'Отгрузка',
    scenarios: [
      'marketplace/offerer/incoming-orders',
      'marketplace/offerer/shipment-prep',
    ],
  },
  {
    name: 'Приёмка на участке',
    scenarios: [
      'marketplace/operator/incoming-shipments',
      'marketplace/operator/apl-reception-create',
      'marketplace/offerer/apl-reception-sign',
      'marketplace/operator/apl-reception-chairman-sign',
      'marketplace/operator/inventory-label',
      'marketplace/operator/warehouse',
    ],
  },
  {
    name: 'Выдача',
    scenarios: [
      'marketplace/operator/issuance-open',
      'marketplace/operator/issuance',
      'marketplace/operator/issuance-no-code',
      'marketplace/orderer/ready-to-receive',
      'marketplace/operator/issuance-finalize',
    ],
  },
  {
    name: 'Возврат',
    scenarios: [
      'marketplace/orderer/returns',
      'marketplace/operator/returns',
    ],
  },
  {
    name: 'Списание',
    scenarios: [
      'marketplace/chairman/writeoff-propose',
    ],
  },
  {
    name: 'Обзорные экраны (состояние не меняют)',
    scenarios: [
      'marketplace/chairman/dashboard-overview',
      'marketplace/chairman/market-tour',
      'marketplace/chairman/ecosystem',
      'marketplace/chairman/warehouse-summary',
      'marketplace/branch-chairman/pvz-list',
      'marketplace/board/payouts-readonly',
      'marketplace/offerer/payments',
      'marketplace/orderer/marketplace-tour',
    ],
  },
];

// ── Аргументы ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const REBOOT = args.includes('--reboot');
const only = (args.find((a) => a.startsWith('--only=')) ?? '').replace('--only=', '');
const from = (args.find((a) => a.startsWith('--from=')) ?? '').replace('--from=', '');

const norm = (s) => (s.startsWith('marketplace/') ? s : `marketplace/${s}`);

let plan = GROUPS.flatMap((g) => g.scenarios.map((s) => ({ group: g.name, scenario: s })));

if (only) {
  const wanted = new Set(only.split(',').map((s) => norm(s.trim())));
  plan = plan.filter((p) => wanted.has(p.scenario));
  const missing = [...wanted].filter((w) => !plan.some((p) => p.scenario === w));
  if (missing.length) {
    console.error(`Не знаю таких сценариев: ${missing.join(', ')}`);
    process.exit(2);
  }
}
if (from) {
  const idx = plan.findIndex((p) => p.scenario === norm(from));
  if (idx < 0) {
    console.error(`--from=${from}: такого сценария нет в плане`);
    process.exit(2);
  }
  plan = plan.slice(idx);
}

// Сверка плана с файлами: сценарий, забытый в плане, не должен молча выпадать
// из сюиты — иначе «всё зелёное» будет означать «мы его просто не гоняли».
if (!only && !from) {
  const onDisk = [];
  const root = path.join(HARNESS_ROOT, 'scenarios/marketplace');
  for (const dir of fs.readdirSync(root)) {
    const full = path.join(root, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const f of fs.readdirSync(full)) {
      if (f.endsWith('.mjs')) onDisk.push(`marketplace/${dir}/${f.replace(/\.mjs$/, '')}`);
    }
  }
  const planned = new Set(plan.map((p) => p.scenario));
  const forgotten = onDisk.filter((s) => !planned.has(s));
  if (forgotten.length) {
    console.error('⚠ сценарии есть на диске, но не включены в план сюиты:');
    for (const f of forgotten) console.error(`    ${f}`);
    console.error('  Добавь их в GROUPS или удали файл — молчаливого пропуска быть не должно.\n');
  }
}

// ── Преflight ──────────────────────────────────────────────────────────────
function curlOk(url, method = 'GET', body = null) {
  const a = ['-s', '-o', '/dev/null', '-w', '%{http_code}', '-X', method, url];
  if (body) a.push('-H', 'content-type: application/json', '-d', body);
  const r = spawnSync('curl', a, { encoding: 'utf8' });
  return /^(2|3|4)\d\d$/.test((r.stdout || '').trim());
}

function envPorts() {
  const file = path.join(REPO_ROOT, '.env');
  const out = { chain: '8888', controller: '2998', desktop: '2999' };
  if (!fs.existsSync(file)) return out;
  const raw = fs.readFileSync(file, 'utf8');
  const pick = (k) => (raw.match(new RegExp(`^\\s*${k}\\s*=\\s*(\\S+)`, 'm')) ?? [])[1];
  return {
    chain: pick('NODE_HTTP_PORT') ?? out.chain,
    controller: pick('COOPBACK_HOST_PORT') ?? out.controller,
    desktop: pick('DESKTOP_HOST_PORT') ?? out.desktop,
  };
}

const PORTS = envPorts();

if (REBOOT) {
  console.log('▸ reboot:extra — чистая цепь и БД (несколько минут)');
  const r = spawnSync('pnpm', ['run', 'reboot:extra'], { cwd: REPO_ROOT, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('reboot:extra провалился — прогон бессмыслен');
    process.exit(2);
  }
  // WIF прежних пайщиков на новой цепи невалидны. Файлы сносим здесь, а не
  // после прогона: иначе первый же логин уйдёт в «неверный ключ доступа»,
  // и причина будет выглядеть как поломка интерфейса.
  const stateDir = path.join(HARNESS_ROOT, 'state/participants');
  for (const f of fs.existsSync(stateDir) ? fs.readdirSync(stateDir) : []) {
    if (f.endsWith('.json')) fs.rmSync(path.join(stateDir, f));
  }
  console.log('  фикстуры пайщиков сброшены — будут созданы заново');

  // Расход пула гейта считается по этому файлу. На новой цепи ни одна оферта
  // не подписана, поэтому пул снова целиком свободен — без сброса сценарий
  // гейта падает «пул исчерпан» на чистом стенде.
  const gateUsed = path.join(HARNESS_ROOT, 'state/gate-used.json');
  if (fs.existsSync(gateUsed)) {
    fs.rmSync(gateUsed);
    console.log('  пул пайщиков для гейта сброшен');
  }
}

// public/config.js: в SPA-dev нет SSR-middleware, и без него фронт уходит на
// config.default.js с адресами чужого стенда. См. lib/desktop-config.mjs.
const cfg = ensureDesktopConfig();
console.log(`▸ конфиг фронта ${cfg.written ? 'обновлён' : 'актуален'}: ${cfg.config.BACKEND_URL}`);

const checks = [
  ['цепь', `http://127.0.0.1:${PORTS.chain}/v1/chain/get_info`, 'GET', null],
  ['controller', `http://127.0.0.1:${PORTS.controller}/v1/graphql`, 'POST', '{"query":"{__typename}"}'],
  ['desktop', `http://127.0.0.1:${PORTS.desktop}`, 'GET', null],
];
// После reboot контейнеры уже запущены, но контроллер ещё компилируется
// (nodemon + ts) и минуту-полторы не отвечает. Мгновенная проверка роняла
// прогон сразу после успешного reboot — ждём, а не сдаёмся на первом отказе.
const WAIT_SECONDS = REBOOT ? 300 : 30;
for (const [name, url, method, body] of checks) {
  const deadline = Date.now() + WAIT_SECONDS * 1000;
  let ok = curlOk(url, method, body);
  if (!ok) console.log(`  … ${name} ещё не отвечает, жду до ${WAIT_SECONDS}с`);
  while (!ok && Date.now() < deadline) {
    spawnSync('sleep', ['5']);
    ok = curlOk(url, method, body);
  }
  if (!ok) {
    console.error(`✗ ${name} не отвечает (${url}) за ${WAIT_SECONDS}с. Подними стек и повтори.`);
    process.exit(2);
  }
  console.log(`  ✓ ${name}`);
}

// ── Фикстуры ───────────────────────────────────────────────────────────────
// Пайщиков создаём заранее и все сразу, а не по ходу: создание идёт через
// цепь и занимает секунды, и делать это в середине прогона — значит мешать
// шум инфраструктуры с результатом сценария.
const needed = new Set();
for (const item of plan) {
  for (const n of fixturesOfScenario(item.scenario)) needed.add(n);
}
if (needed.size) {
  console.log(`\n▸ пайщики для прогона: ${[...needed].join(', ')}`);
  for (const name of needed) {
    try {
      const how = ensureFixture(name, { log: (m) => console.log(`    ${m}`) });
      if (how === 'created') console.log(`  ✓ ${name} создан`);
    } catch (e) {
      console.error(`✗ ${e.message}`);
      process.exit(2);
    }
  }
}

// ── Подготовка стенда ──────────────────────────────────────────────────────
// Фазы, заявленные сценариями в meta.prepare (принятие ЦПП советом и т.п.).
// Идемпотентны, поэтому гоняем их до прогона все разом: доготавливать стенд
// в середине сюиты — значит мешать шум подготовки с результатом сценария.
const prepareSpecs = await collectPrepare(plan.map((p) => p.scenario));
if (prepareSpecs.length) {
  console.log(`\n▸ подготовка стенда: ${prepareSpecs.join(', ')}`);
  try {
    runPrepare(prepareSpecs, { log: (m) => console.log(`    ${m}`) });
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(2);
  }
}

// ── Прогон ─────────────────────────────────────────────────────────────────
const started = Date.now();
const results = [];
let currentGroup = null;

for (const item of plan) {
  if (item.group !== currentGroup) {
    currentGroup = item.group;
    console.log(`\n══ ${currentGroup}`);
  }
  const t0 = Date.now();
  const r = spawnSync('node', ['run.mjs', item.scenario], { cwd: HARNESS_ROOT, stdio: 'inherit' });
  const sec = Math.round((Date.now() - t0) / 1000);

  const resultFile = path.join(HARNESS_ROOT, 'shots', item.scenario, 'result.json');
  let verdict = null;
  try {
    verdict = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
  } catch {
    /* сценарий упал до записи вердикта */
  }

  results.push({
    scenario: item.scenario,
    group: item.group,
    status: r.status === 0 ? 'passed' : 'failed',
    mode: verdict?.mode ?? null,
    feature: verdict?.feature ?? null,
    cases: verdict?.cases ?? [],
    reason: verdict?.reason ?? (r.status === 0 ? null : 'процесс завершился ненулевым кодом'),
    durationSec: sec,
  });
}

// ── Сводка ─────────────────────────────────────────────────────────────────
const passed = results.filter((r) => r.status === 'passed');
const failed = results.filter((r) => r.status === 'failed');

console.log(`\n═══ итог: ${passed.length} зелёных, ${failed.length} красных из ${results.length}`);
console.log(`    время: ${Math.round((Date.now() - started) / 60000)} мин`);
if (failed.length) {
  console.log('\n    красные:');
  for (const f of failed) console.log(`      ✗ ${f.scenario} — ${(f.reason ?? '').slice(0, 160)}`);
}

const suiteDir = path.join(HARNESS_ROOT, 'shots/_suite');
fs.mkdirSync(suiteDir, { recursive: true });
fs.writeFileSync(
  path.join(suiteDir, 'summary.json'),
  JSON.stringify({ at: new Date().toISOString(), passed: passed.length, failed: failed.length, results }, null, 2),
);
console.log(`\n    сводка: ${path.relative(REPO_ROOT, path.join(suiteDir, 'summary.json'))}`);
console.log('    статусы в реестр:  node bin/registry-sync.mjs --apply');

process.exit(failed.length ? 1 : 0);
