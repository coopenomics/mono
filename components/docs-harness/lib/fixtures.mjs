// Тестовые пайщики: реестр профилей и создание на свежей цепи.
//
// Вынесено из bin/shoot.mjs, потому что фикстуры нужны двум входам: и
// одиночному прогону (shoot.mjs), и сюите (bin/run-marketplace-all.mjs).
// После `reboot:extra` прежние WIF невалидны — state/participants/*.json
// удаляются, и оба входа должны уметь пересоздать пайщиков сами, иначе
// «зелёная сюита» будет означать лишь «мы не дошли до логина».
//
// Имена только человеческие: они попадают в скриншоты документации
// (см. doc-shoot/SKILL.md, «Фиксированные конвенции»).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(HARNESS_ROOT, '../..');

export const KNOWN_FIXTURES = {
  ivanpetrov: { email: 'ivan.petrov@example.com', firstName: 'Иван', lastName: 'Петров', middleName: 'Сергеевич' },
  ekaterina: { email: 'ekaterina.smirnova@example.com', firstName: 'Екатерина', lastName: 'Смирнова', middleName: 'Александровна' },
  // newadapter — пайщик БЕЗ Capital-регистрации (его не трогает фаза
  // 05-additional-contributors). Используется в сценарии adaptation.
  newadapter: { email: 'andrey.sidorov@example.com', firstName: 'Андрей', lastName: 'Сидоров', middleName: 'Михайлович' },

  // === Marketplace MVP «Стол заказов» ===
  // Председатели КУ — обычные пайщики, на которых председатель кооператива
  // повесил branch.trustee через branch::createbranch.
  chairkrg: { email: 'chairkrg@voskhod.coop', firstName: 'Пётр', lastName: 'Иванов', middleName: 'Сергеевич' },
  chairodn: { email: 'chairodn@voskhod.coop', firstName: 'Сергей', lastName: 'Орлов', middleName: 'Васильевич' },
  chairmyt: { email: 'chairmyt@voskhod.coop', firstName: 'Алексей', lastName: 'Мытищенко', middleName: 'Григорьевич' },
  trustedkrg: { email: 'trustedkrg@voskhod.coop', firstName: 'Михаил', lastName: 'Петров', middleName: 'Андреевич' },
  opkrg: { email: 'opkrg@voskhod.coop', firstName: 'Александр', lastName: 'Кузнецов', middleName: 'Владимирович' },
  sidorov: { email: 'sidorov@voskhod.coop', firstName: 'Дмитрий', lastName: 'Сидоров', middleName: 'Николаевич' },
  petrova: { email: 'petrova@voskhod.coop', firstName: 'Екатерина', lastName: 'Петрова', middleName: 'Александровна' },

  // Пул для сценария первого входа на Стол заказов. Подпись оферты ЦПП —
  // ончейн-действие, отменить его нельзя, поэтому пайщик «расходуется» за один
  // прогон. Чтобы сценарий воспроизводился без reboot, берём следующего
  // неподключённого из пула (см. freshGateFixture).
  kozlova: { email: 'kozlova@voskhod.coop', firstName: 'Мария', lastName: 'Козлова', middleName: 'Ивановна' },
  novikov: { email: 'novikov@voskhod.coop', firstName: 'Сергей', lastName: 'Новиков', middleName: 'Петрович' },
  fedorova: { email: 'fedorova@voskhod.coop', firstName: 'Ольга', lastName: 'Фёдорова', middleName: 'Дмитриевна' },
  morozov: { email: 'morozov@voskhod.coop', firstName: 'Артём', lastName: 'Морозов', middleName: 'Сергеевич' },
};

// Кандидаты для сценария гейта, по порядку расходования.
export const GATE_POOL = ['petrova', 'kozlova', 'novikov', 'fedorova', 'morozov'];

/**
 * Возвращает имя пайщика, ещё не подключённого к Столу заказов, создавая его
 * при необходимости. Признак расходования — файл state/gate-used.json: он
 * локальный, как и сами фикстуры, и переживает прогоны в пределах стенда.
 * После reboot стенда его чистят вместе с фикстурами.
 */
export function freshGateFixture({ log = () => {} } = {}) {
  const usedFile = path.join(HARNESS_ROOT, 'state/gate-used.json');
  const used = fs.existsSync(usedFile) ? JSON.parse(fs.readFileSync(usedFile, 'utf8')) : [];
  const next = GATE_POOL.find((name) => !used.includes(name));
  if (!next) {
    throw new Error(
      `пул пайщиков для гейта исчерпан (${GATE_POOL.join(', ')}): подпись оферты не отменяется, ` +
      'нужен reboot:extra либо новые профили в KNOWN_FIXTURES',
    );
  }
  ensureFixture(next, { log });
  fs.mkdirSync(path.dirname(usedFile), { recursive: true });
  fs.writeFileSync(usedFile, JSON.stringify([...used, next], null, 2));
  return next;
}

function readEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

export function harnessPorts() {
  const e = readEnvFile(path.join(REPO_ROOT, '.env'));
  return {
    chain: e.NODE_HTTP_PORT || '8888',
    controller: e.COOPBACK_HOST_PORT || '2998',
    desktop: e.DESKTOP_HOST_PORT || '2999',
    postgres: e.PG_HOST_PORT || '5532',
    mongo: e.MONGO_HOST_PORT || '27017',
  };
}

export function fixturePath(name) {
  return path.join(HARNESS_ROOT, 'state/participants', `${name}.json`);
}

/**
 * Создаёт пайщика, если его файла ещё нет. Возвращает 'exists' | 'created'.
 * Бросает, если имя не описано в KNOWN_FIXTURES: молча выдумывать e-mail и
 * ФИО нельзя — они попадут в скриншоты документации.
 */
export function ensureFixture(name, { log = () => {} } = {}) {
  const target = fixturePath(name);
  if (fs.existsSync(target)) return 'exists';

  const profile = KNOWN_FIXTURES[name];
  if (!profile) {
    throw new Error(
      `фикстура «${name}» не описана в KNOWN_FIXTURES (lib/fixtures.mjs) — добавь профиль (e-mail и ФИО) или создай файл вручную`
    );
  }

  log(`создаю пайщика ${name} (${profile.lastName} ${profile.firstName})`);
  const ports = harnessPorts();
  const pg = readEnvFile(path.join(REPO_ROOT, 'components/controller/.env'));
  const env = {
    ...process.env,
    MONGO_URI: `mongodb://127.0.0.1:${ports.mongo}/cooperative-x`,
    POSTGRES_HOST: '127.0.0.1',
    POSTGRES_PORT: ports.postgres,
    POSTGRES_USERNAME: pg.POSTGRES_USERNAME || 'postgres',
    POSTGRES_PASSWORD: pg.POSTGRES_PASSWORD || 'postgres!23!23',
    POSTGRES_DATABASE: pg.POSTGRES_DATABASE || 'voskhod',
    CHAIN_URL: `http://127.0.0.1:${ports.chain}`,
    CONTROLLER_GRAPHQL_URL: `http://127.0.0.1:${ports.controller}/v1/graphql`,
  };

  const r = spawnSync(
    'pnpm',
    [
      '--filter', '@coopenomics/boot', 'exec', 'esno',
      'src/scripts/add-plain-participant.ts',
      name, profile.email, profile.firstName, profile.lastName, profile.middleName,
    ],
    { cwd: REPO_ROOT, env, encoding: 'utf8' }
  );
  if (r.status !== 0) {
    throw new Error(`add-plain-participant для ${name} упал:\n${r.stderr || r.stdout}`);
  }
  const lastLine = (r.stdout || '').split('\n').filter((l) => l.trim()).pop();
  if (!lastLine || !lastLine.startsWith('{')) {
    throw new Error(`не нашёл JSON в выводе add-plain-participant для ${name}:\n${r.stdout}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, lastLine + '\n');
  return 'created';
}

/**
 * Имена фикстур, нужных сценарию: из meta.fixtures и из прямых обращений
 * к state/participants/<name>.json в тексте сценария.
 */
export function fixturesOfScenario(scenario, meta = {}) {
  const names = new Set(Array.isArray(meta.fixtures) ? meta.fixtures : []);
  const file = path.join(HARNESS_ROOT, 'scenarios', `${scenario}.mjs`);
  if (fs.existsSync(file)) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/state\/participants\/([\w-]+)\.json/g)) names.add(m[1]);
  }
  return [...names];
}
