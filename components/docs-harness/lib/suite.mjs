// Общий раннер сюиты приложения (Стол заказов, Образование, …).
//
// Вынесено из bin/run-marketplace-all.mjs: у каждого приложения свои группы
// сценариев по цепочке состояния, а механика одна — проверка стенда, пайщики-
// фикстуры, фазы подготовки, прогон по плану, сводка. Второй раннер скопировал
// бы триста строк и разошёлся бы на первой правке.
//
// runSuite({ app, groups, args }):
//   app    — каталог scenarios/<app> и префикс имён сценариев;
//   groups — [{ name, scenarios: [...] }], группа с префиксом «L0» идёт ДО
//            глобальных prepare-фаз (девственный стенд);
//   args   — process.argv.slice(2): --reboot, --only=, --from=.
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureDesktopConfig } from './desktop-config.mjs';
import { ensureFixture, fixturesOfScenario } from './fixtures.mjs';
import { collectPrepare, runPrepare } from './prepare.mjs';
import { ensureChairmanPassword, ensureChairmanTokens, ensureTokens, forgetLoginState } from './tokens.mjs';

const HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(HARNESS_ROOT, '../..');

export async function runSuite({ app, groups, args = [] }) {
const GROUPS = groups;
  const REBOOT = args.includes('--reboot');
  const only = (args.find((a) => a.startsWith('--only=')) ?? '').replace('--only=', '');
  const from = (args.find((a) => a.startsWith('--from=')) ?? '').replace('--from=', '');

  const norm = (s) => (s.startsWith(`${app}/`) ? s : `${app}/${s}`);

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
    const root = path.join(HARNESS_ROOT, 'scenarios', app);
    for (const dir of fs.readdirSync(root)) {
      const full = path.join(root, dir);
      if (!fs.statSync(full).isDirectory()) continue;
      for (const f of fs.readdirSync(full)) {
        if (f.endsWith('.mjs')) onDisk.push(`${app}/${dir}/${f.replace(/\.mjs$/, '')}`);
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
    // После пересоздания цепи parser2 может остаться на SHiP-стриме старой:
    // «блоков нет 60 с — чтение остановилось», таблицы цепи в PG пустеют, и
    // первая же prepare-фаза падает на «Информация о кооперативе не обнаружена».
    // Профилактический рестарт заставляет его переподключиться к новой цепи.
    console.log('▸ рестарт parser2 (SHiP-стрим новой цепи)...');
    spawnSync('docker', ['compose', 'restart', 'parser2'], { cwd: REPO_ROOT, stdio: 'inherit' });
    const stateDir = path.join(HARNESS_ROOT, 'state/participants');
    for (const f of fs.existsSync(stateDir) ? fs.readdirSync(stateDir) : []) {
      if (f.endsWith('.json')) fs.rmSync(path.join(stateDir, f));
    }
    console.log('  фикстуры пайщиков сброшены — будут созданы заново');

    // Расход пула гейта считается по этому файлу. На новой цепи ни одна оферта
    // не подписана, поэтому пул снова целиком свободен — без сброса сценарий
    // гейта падает «пул исчерпан» на чистом стенде.
    // Пароли и токены прежней цепи недействительны.
    forgetLoginState();
    for (const f of ['state/gate-used.json', 'state/edu-gate-used.json']) {
      const gateUsed = path.join(HARNESS_ROOT, f);
      if (fs.existsSync(gateUsed)) {
        fs.rmSync(gateUsed);
        console.log(`  пул пайщиков для гейта сброшен (${f})`);
      }
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
  // После reboot контроллер поднимается через ts-node: на загруженной машине
  // (стенд делят соседние чекауты) компиляция вместе с миграциями TypeORM
  // занимает больше пяти минут, и прогон срывался на преflight'е уже после
  // успешной перезагрузки. Ждём десять — простой дешевле повторного reboot'а.
  const WAIT_SECONDS = REBOOT ? 600 : 30;
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

  // ── Токены для засева ──────────────────────────────────────────────────────
  // Подписью, до первого входа со стола: вход переводит пайщика на пароль, и
  // подпись его больше не впускает, а фазам засева токены нужны и после L0.
  try {
    const slog = (m) => console.log(`    ${m}`);
    if (ensureChairmanPassword({ log: slog }) === 'created') slog('председателю поставлен пароль стенда, ключ прежний');
    ensureTokens([...needed], { log: slog });
    await ensureChairmanTokens({ log: slog });
  } catch (e) {
    console.error(`✗ ${e.message}`);
    return 2;
  }

  // ── Подготовка стенда ──────────────────────────────────────────────────────
  // Фазы, заявленные сценариями в meta.prepare (принятие ЦПП советом и т.п.).
  // Идемпотентны, поэтому гоняем их до прогона все разом: доготавливать стенд
  // в середине сюиты — значит мешать шум подготовки с результатом сценария.
  // Группы с префиксом «L0» снимают девственный стенд (процесс подключения ЦПП)
  // и обязаны пройти ДО глобальных prepare-фаз — их сценарии сами доводят
  // состояние через runSeedPhase. Остальной план ждёт полной подготовки.
  const preparePlan = plan.filter((p) => p.group.startsWith('L0'));
  plan = plan.filter((p) => !p.group.startsWith('L0'));

  const started = Date.now();
  const results = [];
  let currentGroup = null;

  if (preparePlan.length) {
    console.log('\n▸ L0: девственный стенд — до подготовки');
    for (const item of preparePlan) runScenarioItem(item);
  }

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
  // Тело прогона одного сценария вынесено в функцию: L0-план зовёт её ДО
  // глобальных prepare-фаз (hoisting function declaration это позволяет).
  function runScenarioItem(item) {
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

  for (const item of plan) runScenarioItem(item);

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

  return failed.length ? 1 : 0;
}
