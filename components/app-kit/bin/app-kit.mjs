#!/usr/bin/env node
/**
 * @coopenomics/app-kit — набор издателя приложений каталога (487-37).
 *
 *   npx @coopenomics/app-kit create @<кооператив>/<имя> ["Заголовок"] [--catalog <адрес>]
 *   npx @coopenomics/app-kit publish [папка приложения] [--catalog <адрес>]
 *
 * `create` копирует образец приложения из папки template набора и даёт копии
 * свои имена: приложения одного узла подключены к общей схеме GraphQL и к
 * одному рабочему столу, имена обязаны быть уникальными. Адрес каталога
 * записывается в поле `catalog.url` манифеста приложения: команда выпуска
 * читает адрес из этого поля.
 *
 * `publish` собирает образ бэкенда, публикует пакет и подаёт выпуск —
 * scripts/catalog-release.sh набора. Ключ API берётся из переменной
 * CATALOG_PUBLISHER_TOKEN, из файла .catalog-key папки приложения либо
 * спрашивается в терминале при первом выпуске и сохраняется в .catalog-key.
 *
 * Требуется: Node.js 18+, npm, bash, curl и запущенный Docker.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KIT_VERSION = JSON.parse(readFileSync(join(KIT, 'package.json'), 'utf8')).version;
/** Имя приложения: от 2 до 12 символов a–z и 1–5, первая — буква; то же правило у стола разработчика. */
const NAME_RE = /^[a-z][a-z1-5]{1,11}$/;
/** Пространство имён — имя аккаунта кооператива в цепи. */
const SCOPE_RE = /^[a-z1-5.]{1,12}$/;
const TOKEN_PREFIX = 'cpt_';
const KEY_FILE = '.catalog-key';

function fail(message, code = 2) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function usage() {
  return [
    'Набор издателя приложений каталога.',
    '',
    '  npx @coopenomics/app-kit create @<кооператив>/<имя> ["Заголовок"] [--catalog <адрес>]',
    '  npx @coopenomics/app-kit publish [папка приложения] [--catalog <адрес>]',
    '',
    'Команды с подставленными именем и адресом каталога показывает стол разработчика,',
    'страница «Выпуск из терминала».',
  ].join('\n');
}

/** Позиционные аргументы и `--catalog <адрес>` / `--catalog=<адрес>`. */
function parseArgs(argv) {
  const positional = [];
  let catalog = '';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--catalog') catalog = argv[(i += 1)] ?? '';
    else if (arg.startsWith('--catalog=')) catalog = arg.slice('--catalog='.length);
    else if (arg === '--help' || arg === '-h') positional.unshift('help');
    else positional.push(arg);
  }
  return { positional, catalog: catalog.replace(/\/+$/, '') };
}

// ── create ────────────────────────────────────────────────────────────────

/** Замены имён образца: порядок важен — сначала точные формы. */
function renameSources(dir, scope, name, pascal) {
  const replacements = [
    [/@ObjectType\('Note'\)/g, `@ObjectType('${pascal}Note')`],
    [/ExampleApp/g, pascal],
    [/exampleApp/g, name],
    [/@voskhod\/exampleapp/g, `@${scope}/${name}`],
    [/exampleapp/g, name],
  ];
  const wanted = /\.(ts|js|json|html)$|^Dockerfile$/;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') renameSources(file, scope, name, pascal);
    } else if (wanted.test(entry.name)) {
      const before = readFileSync(file, 'utf8');
      const after = replacements.reduce((text, [from, to]) => text.replace(from, to), before);
      if (after !== before) writeFileSync(file, after);
    }
  }
}

function writeManifest(dest, { scope, name, title, catalog }) {
  const file = join(dest, 'package.json');
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  pkg.name = `@${scope}/${name}`;
  pkg.version = '0.1.0';
  pkg.description = `${title} — приложение каталога.`;
  pkg.coopenomics.backend.image = `${scope}/${name}:0.1.0`;
  pkg.coopenomics.frontend = {
    frame: pkg.coopenomics.frontend?.frame ?? 'frontend/frame.html',
    workspace: { name, title, icon: pkg.coopenomics.frontend?.workspace?.icon ?? 'extension' },
  };
  pkg.catalog.workspaces = [name];
  pkg.catalog.publisher = { ...(pkg.catalog.publisher ?? {}), coopname: scope };
  if (catalog) pkg.catalog.url = catalog;
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);

  // Бэкенд берёт SDK приложений той же версии, что и набор.
  const backendFile = join(dest, 'backend', 'package.json');
  const backend = readFileSync(backendFile, 'utf8').replaceAll('__APP_KIT_SDK_VERSION__', KIT_VERSION);
  const parsed = JSON.parse(backend);
  parsed.version = '0.1.0';
  parsed.description = `Бэкенд приложения @${scope}/${name}.`;
  writeFileSync(backendFile, `${JSON.stringify(parsed, null, 2)}\n`);

  const frameFile = join(dest, 'frontend', 'frame.html');
  writeFileSync(frameFile, readFileSync(frameFile, 'utf8').replace(/Example App/g, title));
}

function writeReadme(dest, { scope, name, title }) {
  writeFileSync(
    join(dest, 'README.md'),
    [
      `# @${scope}/${name}`,
      '',
      `${title} — приложение каталога. Каркас создан командой \`npx @coopenomics/app-kit create\`.`,
      '',
      '| Часть | Где |',
      '| --- | --- |',
      '| манифест пакета, права ядра (`coopenomics.ports`, `coopenomics.chainActions`) | `package.json` |',
      '| фронт для изолированной рамки стола | `frontend/frame.html` |',
      '| бэкенд (GraphQL, порты ядра) и его образ | `backend/` |',
      '',
      '## Выпуск',
      '',
      '```bash',
      'npx @coopenomics/app-kit publish',
      '```',
      '',
      'Первый выпуск ждёт модератора каталога. Обновление без новых прав ядра каталог',
      'активирует сам. Перед каждым обновлением поднимите `version` в `package.json`.',
      '',
      'Ключ API выпускает стол разработчика, страница «Ключи API». На сервере сборки',
      'ключ задаёт переменная `CATALOG_PUBLISHER_TOKEN`.',
      '',
    ].join('\n'),
  );
}

function create(args) {
  const [target, titleArg] = args.positional;
  const match = /^@([^/]+)\/(.+)$/.exec(target ?? '');
  const scope = match ? match[1] : (process.env.APP_SCOPE ?? '');
  const name = match ? match[2] : (target ?? '');
  if (!NAME_RE.test(name)) fail(`Имя «${name}»: от 2 до 12 символов a–z и 1–5, первая — буква.\n\n${usage()}`);
  if (!SCOPE_RE.test(scope)) fail(`Укажите пакет полностью: @<кооператив>/${name || '<имя>'}.\n\n${usage()}`);
  if (name === 'exampleapp') fail('Имя exampleapp занято образцом — выберите другое.');
  const pascal = name[0].toUpperCase() + name.slice(1);
  const title = titleArg || process.env.APP_TITLE || pascal;
  const catalog = args.catalog || (process.env.CATALOG_URL ?? '').replace(/\/+$/, '');
  const dest = resolve(process.cwd(), name);
  if (existsSync(dest)) fail(`Папка ${dest} уже существует — удалите её или выберите другое имя.`, 1);

  cpSync(join(KIT, 'template'), dest, { recursive: true });
  renameSources(dest, scope, name, pascal);
  writeManifest(dest, { scope, name, title, catalog });
  writeReadme(dest, { scope, name, title });

  process.stdout.write(
    [
      `Каркас:  ${dest}`,
      `Пакет:   @${scope}/${name} 0.1.0`,
      `Каталог: ${catalog || 'не задан — укажите --catalog при выпуске'}`,
      '',
      'Выпуск:',
      `  cd ${name}`,
      '  npx @coopenomics/app-kit publish',
      '',
    ].join('\n'),
  );
}

// ── publish ───────────────────────────────────────────────────────────────

function askHidden(question) {
  return new Promise((resolveAnswer) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // Ввод ключа не отображается на экране.
    rl._writeToOutput = (chunk) => {
      if (chunk.includes(question)) process.stdout.write(chunk);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolveAnswer(answer.trim());
    });
  });
}

async function publisherToken(appDir, pkgName) {
  const fromEnv = (process.env.CATALOG_PUBLISHER_TOKEN ?? '').trim();
  if (fromEnv) return fromEnv;
  const keyFile = join(appDir, KEY_FILE);
  if (existsSync(keyFile)) return readFileSync(keyFile, 'utf8').trim();
  if (!process.stdin.isTTY) fail('Нет ключа API: задайте CATALOG_PUBLISHER_TOKEN либо запустите команду в терминале.');
  process.stdout.write(`Ключ API для ${pkgName} выпускает стол разработчика, страница «Ключи API».\n`);
  const token = await askHidden(`Ключ ${TOKEN_PREFIX}…: `);
  if (!token.startsWith(TOKEN_PREFIX)) fail(`Ключ API начинается с ${TOKEN_PREFIX} — проверьте, что ключ скопирован целиком.`);
  writeFileSync(keyFile, `${token}\n`, { mode: 0o600 });
  chmodSync(keyFile, 0o600);
  process.stdout.write(`Ключ сохранён: ${keyFile}\n`);
  return token;
}

async function publish(args) {
  const appDir = resolve(process.cwd(), args.positional[0] ?? '.');
  const manifestFile = join(appDir, 'package.json');
  if (!existsSync(manifestFile)) fail(`Нет package.json в ${appDir}. Запустите команду из папки приложения.`);
  const pkg = JSON.parse(readFileSync(manifestFile, 'utf8'));
  const catalog = args.catalog || (process.env.CATALOG_URL ?? '').replace(/\/+$/, '') || pkg.catalog?.url;
  if (!catalog) fail('Адрес каталога не задан: укажите --catalog <адрес> либо поле catalog.url в package.json.');
  const token = await publisherToken(appDir, pkg.name);

  process.stdout.write(`Выпуск ${pkg.name} ${pkg.version} → ${catalog}\n`);
  const run = spawnSync('bash', [join(KIT, 'scripts', 'catalog-release.sh')], {
    stdio: 'inherit',
    env: { ...process.env, CATALOG_URL: catalog, CATALOG_PUBLISHER_TOKEN: token, PACKAGE_DIR: appDir },
  });
  if (run.error) fail(`Команда выпуска не запустилась: ${run.error.message}. Требуется bash.`, 1);
  if (run.status === 0) {
    process.stdout.write('\nГотово. Следующий выпуск: поднимите version в package.json и повторите команду.\n');
  } else if (!process.env.CATALOG_PUBLISHER_TOKEN && existsSync(join(appDir, KEY_FILE))) {
    process.stdout.write(`\nКаталог отклонил ключ — удалите ${join(appDir, KEY_FILE)} и выпустите новый ключ на столе разработчика.\n`);
  }
  process.exit(run.status ?? 1);
}

const args = parseArgs(process.argv.slice(2));
const command = args.positional.shift();
if (command === 'create') create(args);
else if (command === 'publish') await publish(args);
else {
  process.stdout.write(`${usage()}\n`);
  process.exit(command && command !== 'help' ? 2 : 0);
}
