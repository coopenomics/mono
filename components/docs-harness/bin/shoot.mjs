#!/usr/bin/env node
// Orchestrator: pre-flight + автопочинка типовых грабель + прогон сценария.
// Один вход для doc-shoot скилла: `node bin/shoot.mjs <scenario>` делает всё,
// что иначе пришлось бы дёргать руками.
//
// Опции:
//   --reboot   полная перезагрузка стека (`pnpm run reboot:extra`) перед прогоном;
//              сносит blockchain-data + volumes + удаляет фикстуры пайщиков
//              (их WIF после новой цепочки невалидны). Использовать когда сценарий
//              нужен «с нуля» или цепочка/БД разъехались с фикстурами.
//
// Что НЕ делает:
//   - не пишет прозу в draft.md (это работа Claude по фактам со скриншотов)
//   - не запускает install.mjs (запись в components/docs/, оставляем под ручной контроль)

import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Harness живёт в components/docs-harness/, репо-корень — на два уровня выше.
const REPO_ROOT = path.resolve(HARNESS_ROOT, '..', '..');

const args = process.argv.slice(2);
const wantReboot = args.includes('--reboot');
const scenario = args.find((a) => !a.startsWith('--'));
if (!scenario) {
  console.error('Usage: node bin/shoot.mjs <scenario> [--reboot]   (например auth/signin)');
  process.exit(2);
}

// Известные тестовые пайщики — один раз создаются на свежей цепочке,
// дальше их WIF лежит в state/participants/<name>.json и переиспользуется.
// Имена ТОЛЬКО человеческие (см. doc-shoot/SKILL.md «Фиксированные конвенции»).
const KNOWN_FIXTURES = {
  ivanpetrov: { email: 'ivan.petrov@example.com', firstName: 'Иван', lastName: 'Петров', middleName: 'Сергеевич' },
  ekaterina: { email: 'ekaterina.smirnova@example.com', firstName: 'Екатерина', lastName: 'Смирнова', middleName: 'Александровна' },
  // newadapter — пайщик БЕЗ Capital-регистрации (его не трогает фаза
  // 05-additional-contributors). Используется в сценарии adaptation для
  // снимков мастера выбора ролей / часов / ставки / документов УХД.
  newadapter: { email: 'andrey.sidorov@example.com', firstName: 'Андрей', lastName: 'Сидоров', middleName: 'Михайлович' },
};

const log = (m) => console.error(`◇ ${m}`);
const ok = (m) => console.error(`✓ ${m}`);
const die = (m) => { console.error(`✗ ${m}`); process.exit(1); };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readDotEnv() {
  const out = {};
  const file = path.join(REPO_ROOT, '.env');
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function readPgEnv() {
  // Postgres креды берём из controller/.env — там единственное надёжное место,
  // где зафиксированы хост-порт, юзер и пароль для локальной сборки.
  const file = path.join(REPO_ROOT, 'components/controller/.env');
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function curlOk(url, method = 'GET', body = null) {
  const args = ['-sf', '-m', '3', '-o', '/dev/null', url];
  if (method !== 'GET') args.push('-X', method);
  if (body) args.push('-H', 'Content-Type: application/json', '-d', body);
  return spawnSync('curl', args, { stdio: 'ignore' }).status === 0;
}

const dotenv = readDotEnv();
const PORTS = {
  chain: dotenv.NODE_HTTP_PORT || '8888',
  controller: dotenv.COOPBACK_HOST_PORT || '2998',
  desktop: dotenv.DESKTOP_HOST_PORT || '2999',
  postgres: dotenv.PG_HOST_PORT || '5532',
  mongo: dotenv.MONGO_HOST_PORT || '27017',
};

// 0. Полный reboot по запросу: --reboot снесёт blockchain-data и пересоздаст volumes;
//    фикстуры пайщиков с прошлыми WIF на новой цепочке невалидны — чистим state, потом
//    ensureFixture() пересоздаст с новым keypair'ом.
async function doReboot() {
  log('Полная перезагрузка стека через `pnpm run reboot:extra` (~3-5 мин)...');
  const r = spawnSync('pnpm', ['run', 'reboot:extra'], { cwd: REPO_ROOT, stdio: 'inherit' });
  if (r.status !== 0) die('pnpm run reboot:extra упал');
  log('Чищу старые фикстуры пайщиков (WIF невалиден после новой цепочки)...');
  const stateDir = path.join(HARNESS_ROOT, 'state/participants');
  if (fs.existsSync(stateDir)) {
    for (const f of fs.readdirSync(stateDir)) {
      if (f.endsWith('.json')) fs.rmSync(path.join(stateDir, f));
    }
  }
  ok('reboot завершён');
}

// 1. Стек: лежащие сервисы поднимаем через docker compose up -d (не деструктивно).
//    Если после старта всё равно не поднялось — die с пояснением.
async function bringUp(service) {
  log(`Поднимаю ${service} через docker compose up -d...`);
  const r = spawnSync('docker', ['compose', 'up', '-d', service], { cwd: REPO_ROOT, stdio: 'inherit' });
  if (r.status !== 0) die(`docker compose up -d ${service} упал`);
}

async function ensureService(name, healthCheck, service, timeoutSec = 60) {
  if (healthCheck()) return;
  await bringUp(service);
  for (let i = 0; i < timeoutSec / 2; i++) {
    await sleep(2000);
    if (healthCheck()) { ok(`${name} поднят`); return; }
  }
  die(`${name} не отвечает за ${timeoutSec}с после docker compose up -d ${service}`);
}

async function checkStack() {
  log('Проверяю стек (chain/controller/parser)...');
  await ensureService(
    `chain :${PORTS.chain}`,
    () => curlOk(`http://127.0.0.1:${PORTS.chain}/v1/chain/get_info`),
    'node',
    120,
  );
  await ensureService(
    `controller :${PORTS.controller}`,
    () => curlOk(`http://127.0.0.1:${PORTS.controller}/v1/graphql`, 'POST', '{"query":"{__typename}"}'),
    'coopback',
    // 180с — после reboot:extra coopback грузит контракты ~2 мин;
    // 90с не хватало, первый сценарий после --reboot падал.
    180,
  );
  const parserUp = () => {
    const r = spawnSync('docker', ['compose', 'ps', 'cooparser', '--format', 'json'], { cwd: REPO_ROOT, encoding: 'utf8' });
    return r.status === 0 && /"State":"running"/.test(r.stdout);
  };
  await ensureService('parser', parserUp, 'cooparser', 60);
  ok('chain, controller, parser живы');
}

// 2. cooptypes/sdk dist — без них desktop отдаёт спиннер, скриншоты пустые
function ensureDist() {
  log('Проверяю собранные cooptypes и sdk...');
  const targets = [
    { name: 'cooptypes', filter: 'cooptypes', dist: path.join(REPO_ROOT, 'components/cooptypes/dist/index.mjs') },
    { name: 'sdk', filter: '@coopenomics/sdk', dist: path.join(REPO_ROOT, 'components/sdk/dist/index.mjs') },
  ];
  const missing = targets.filter((t) => !fs.existsSync(t.dist));
  if (missing.length === 0) { ok('cooptypes и sdk собраны'); return false; }
  log(`Нет dist: ${missing.map((t) => t.name).join(', ')} — собираю через pnpm...`);
  for (const t of missing) {
    const r = spawnSync('pnpm', ['--filter', t.filter, 'build'], { cwd: REPO_ROOT, stdio: 'inherit' });
    if (r.status !== 0) die(`pnpm --filter ${t.filter} build упал`);
  }
  ok('Сборка готова');
  return true;
}

// 3. desktop dev: поднимаем если нет; если только что собрали dist и dev уже работал —
//    рестартуем, иначе vite-plugin-checker держит кэш «no module» и vue-tsc overlay
//    перехватывает клики в playwright (видел на 989-9, фикс через рестарт).
async function ensureDesktop(distRebuilt) {
  log(`Проверяю desktop :${PORTS.desktop}...`);
  const wasUp = curlOk(`http://127.0.0.1:${PORTS.desktop}`);
  if (wasUp && !distRebuilt) { ok('desktop dev живой'); return; }
  if (wasUp && distRebuilt) {
    log('Перезапускаю desktop dev (после билда dist нужен fresh vue-tsc cache)...');
    spawnSync('pkill', ['-f', 'quasar.js dev'], { stdio: 'ignore' });
    await sleep(2000);
  } else {
    log('desktop dev не запущен, поднимаю в фоне...');
  }
  const logFile = '/tmp/desktop-dev.log';
  const out = fs.openSync(logFile, 'a');
  const child = spawn('pnpm', ['run', 'dev'], {
    cwd: path.join(REPO_ROOT, 'components/desktop'),
    detached: true,
    stdio: ['ignore', out, out],
  });
  child.unref();
  log(`Жду пока :${PORTS.desktop} начнёт отвечать (до 180с, лог в ${logFile})...`);
  for (let i = 0; i < 90; i++) {
    await sleep(2000);
    if (curlOk(`http://127.0.0.1:${PORTS.desktop}`)) { ok('desktop dev готов'); return; }
  }
  die(`desktop dev не поднялся за 180с — проверь ${logFile}`);
}

// 4. Фикстура пайщика. Имена берём из двух источников:
//    - meta.fixtures сценария (явный список — для пайщиков, которых использует
//      seed-фаза, но не сам сценарий, например 05-additional-contributors)
//    - state/participants/<name>.json regex'нутые из исходника сценария
//      (для пайщиков, которыми сценарий логинится через UI — см. signin.mjs)
//    Если файла нет — создаём через add-plain-participant, JSON-вывод в state.
function ensureOneFixture(name) {
  const fixturePath = path.join(HARNESS_ROOT, 'state/participants', `${name}.json`);
  if (fs.existsSync(fixturePath)) { ok(`фикстура ${name} есть`); return; }
  const profile = KNOWN_FIXTURES[name];
  if (!profile) {
    die(`фикстура «${name}» не описана в KNOWN_FIXTURES (bin/shoot.mjs). Добавь профиль или создай файл вручную через add-plain-participant.ts.`);
  }
  log(`Создаю фикстуру ${name} через add-plain-participant...`);
  const pg = readPgEnv();
  const env = {
    ...process.env,
    MONGO_URI: `mongodb://127.0.0.1:${PORTS.mongo}/cooperative-x`,
    POSTGRES_HOST: '127.0.0.1',
    POSTGRES_PORT: PORTS.postgres,
    POSTGRES_USERNAME: pg.POSTGRES_USERNAME || 'postgres',
    POSTGRES_PASSWORD: pg.POSTGRES_PASSWORD || 'postgres!23!23',
    POSTGRES_DATABASE: pg.POSTGRES_DATABASE || 'voskhod',
  };
  const r = spawnSync('pnpm', [
    '--filter', '@coopenomics/boot', 'exec', 'esno',
    'src/scripts/add-plain-participant.ts',
    name, profile.email, profile.firstName, profile.lastName, profile.middleName,
  ], { cwd: REPO_ROOT, env, encoding: 'utf8' });
  if (r.status !== 0) {
    die(`add-plain-participant упал:\nstderr:\n${r.stderr}\nstdout:\n${r.stdout}`);
  }
  const lastLine = r.stdout.split('\n').filter((l) => l.trim()).pop();
  if (!lastLine || !lastLine.startsWith('{')) {
    die(`не нашёл JSON в выводе add-plain-participant:\n${r.stdout}`);
  }
  fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
  fs.writeFileSync(fixturePath, lastLine + '\n');
  ok(`фикстура ${name} создана: ${path.relative(REPO_ROOT, fixturePath)}`);
}

function ensureFixtures(meta) {
  const scenarioPath = path.join(HARNESS_ROOT, 'scenarios', `${scenario}.mjs`);
  if (!fs.existsSync(scenarioPath)) die(`сценарий не найден: ${scenarioPath}`);
  const src = fs.readFileSync(scenarioPath, 'utf8');
  const names = new Set();
  if (Array.isArray(meta.fixtures)) {
    for (const n of meta.fixtures) names.add(n);
  }
  for (const m of src.matchAll(/state\/participants\/([\w-]+)\.json/g)) {
    names.add(m[1]);
  }
  if (names.size === 0) { ok('сценарий не требует фикстур'); return; }
  for (const name of names) ensureOneFixture(name);
}

// 4.5. meta.prepare — заявленные сценарием seed-фазы для boot.
//      Спецификация: 'group:phase', например 'capital:01-programs'. Группа
//      резолвится в src/scripts/seed-<group>/index.ts; <phase> идёт аргументом.
//      Каждая фаза — идемпотентна, повторный прогон без reboot — no-op.
async function loadMeta() {
  const scenarioPath = path.join(HARNESS_ROOT, 'scenarios', `${scenario}.mjs`);
  try {
    const mod = await import(scenarioPath);
    return mod.meta || {};
  } catch (e) {
    die(`не смог загрузить meta из сценария:\n${e.stack || e.message}`);
  }
}

async function runPrepare(prepareSpecs) {
  if (!Array.isArray(prepareSpecs) || prepareSpecs.length === 0) return;
  log(`Прогоняю prepare-фазы (${prepareSpecs.length}): ${prepareSpecs.join(', ')}`);
  for (const spec of prepareSpecs) {
    const m = spec.match(/^([\w-]+):([\w-]+)$/);
    if (!m) die(`prepare: не понимаю спецификацию «${spec}» (формат: <group>:<phase>)`);
    const [, group, phase] = m;
    const scriptPath = `src/scripts/seed-${group}/index.ts`;
    const componentPath = path.join(REPO_ROOT, 'components/boot', scriptPath);
    if (!fs.existsSync(componentPath)) {
      die(`prepare: не нашёл seed-скрипт для группы «${group}»: ${componentPath}`);
    }
    log(`prepare ${spec}...`);
    const r = spawnSync('pnpm', [
      '--filter', '@coopenomics/boot', 'exec', 'esno',
      scriptPath, phase,
    ], { cwd: REPO_ROOT, stdio: 'inherit' });
    if (r.status !== 0) die(`prepare ${spec} упала`);
  }
  ok('prepare-фазы пройдены');
}

// 5. Прогон + 6. Скелет draft.md если его ещё нет
function runScenario() {
  log(`Прогоняю сценарий ${scenario}...`);
  const r = spawnSync('node', ['run.mjs', scenario], { cwd: HARNESS_ROOT, stdio: 'inherit' });
  if (r.status !== 0) die(`сценарий упал — смотри shots/${scenario}/FAIL.png и console.log`);
}

function ensureDraft() {
  const manifestPath = path.join(HARNESS_ROOT, 'shots', scenario, 'manifest.json');
  const draftPath = path.join(HARNESS_ROOT, 'shots', scenario, 'draft.md');
  if (fs.existsSync(draftPath)) { ok('draft.md уже есть — не перегенерирую'); return; }
  log('Генерирую скелет draft.md...');
  const r = spawnSync('node', ['lib/render-md.mjs', manifestPath], { cwd: HARNESS_ROOT, stdio: 'inherit' });
  if (r.status !== 0) die('render-md.mjs упал');
}

(async () => {
  if (wantReboot) await doReboot();
  await checkStack();
  const distRebuilt = ensureDist();
  await ensureDesktop(distRebuilt);
  const meta = await loadMeta();
  ensureFixtures(meta);
  await runPrepare(meta.prepare);
  runScenario();
  ensureDraft();
  console.error('');
  const rel = path.relative(REPO_ROOT, HARNESS_ROOT);
  console.error('✓ Готово.');
  console.error(`  PNG:   ${rel}/shots/${scenario}/`);
  console.error(`  draft: ${rel}/shots/${scenario}/draft.md  (правь прозу здесь)`);
  console.error(`  install: cd ${rel} && node lib/install.mjs ${scenario} --md  (когда проза готова)`);
})().catch((e) => die(e.stack || e.message));
