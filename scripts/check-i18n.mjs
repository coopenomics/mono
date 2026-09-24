#!/usr/bin/env node
// Гейт интернационализации: текст для пользователя живёт в словарях.
//
// Три проверки, каждая отдельной подкомандой и все вместе по умолчанию:
//
//   hardcode — кириллица прямо в коде (шаблоны pug/HTML, строки скриптов).
//     Храповик: долг зафиксирован по файлам в scripts/lib/i18n-hardcode-baseline.json,
//     вердикт роняет только рост — новая строка в старом файле или новый файл
//     с текстом. Перенесли строки в словарь — долг снизился, обновить снимок:
//     `node scripts/check-i18n.mjs hardcode --update`.
//     Что сканируется и что не считается — см. scripts/lib/i18n-scan.mjs.
//
//   catalog — словари исправны: каждое сообщение компилируется движком
//     vue-i18n; два словаря не объявляют один ключ; расширение держит ключи
//     под своим именем; каждый ключ, на который ссылается код (t('…'),
//     $t('…'), titleKey: '…', коды DomainError), есть в словаре; ключ,
//     собранный в рантайме (t(`status.${s}`)), указывает на существующую
//     ветвь; запрещённые глоссарием слова не встречаются.
//     Неиспользуемые ключи печатаются справкой и вердикт не роняют.
//
//   types — сгенерированные типы ключей (keys.generated.ts у desktop и
//     controller) совпадают со словарями. Обновить: `types --write`.
//
// Запуск: node scripts/check-i18n.mjs [hardcode|catalog|types] [--update|--write] [--list]
// В `pnpm check` входит целиком.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { createRequire } from 'node:module';
import {
  REPO_ROOT,
  listScanFiles,
  packageOf,
  dictionariesOf,
  appOf,
  extensionNamespace,
  KEY_TYPES,
  HARDCODE_BASELINE,
  GLOSSARY,
} from './lib/i18n-config.mjs';
import { scanFile } from './lib/i18n-scan.mjs';

const require = createRequire(join(REPO_ROOT, 'package.json'));
const { baseCompile } = require('@intlify/message-compiler');

const args = process.argv.slice(2);
const mode = args.find((a) => !a.startsWith('--')) ?? 'all';
const flag = (name) => args.includes(`--${name}`);

// ─── hardcode ───────────────────────────────────────────────────────────────

function countHardcode() {
  const counts = {};
  const errors = [];
  const details = {};
  for (const rel of listScanFiles()) {
    const { found, error } = scanFile(join(REPO_ROOT, rel));
    if (error) errors.push(`${rel}: ${error}`);
    const counted = found.filter((f) => !f.excluded);
    if (counted.length) {
      counts[rel] = counted.length;
      details[rel] = counted;
    }
  }
  return { counts, errors, details };
}

function gateHardcode() {
  const { counts, errors, details } = countHardcode();
  const baselinePath = join(REPO_ROOT, HARDCODE_BASELINE);

  if (flag('update')) {
    // Снимок двигается только вниз: поднять долг обновлением нельзя, иначе
    // гейт превращается в формальность. Первый снимок пишется, когда его нет.
    if (existsSync(baselinePath)) {
      const prev = JSON.parse(readFileSync(baselinePath, 'utf8'));
      const up = Object.entries(counts).filter(([f, c]) => c > (prev[f] ?? 0));
      if (up.length) {
        console.log('  снимок не обновлён: долг вырос — сначала вынесите текст в словарь');
        for (const [f, c] of up) console.log(`  ✗ ${f}: было ${prev[f] ?? 0}, стало ${c}`);
        return 1;
      }
    }
    writeFileSync(baselinePath, JSON.stringify(sortObject(counts), null, 2) + '\n');
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`  снимок обновлён: ${total} строк в ${Object.keys(counts).length} файлах`);
    return 0;
  }

  const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : {};
  const grown = [];
  for (const [file, count] of Object.entries(counts)) {
    const was = baseline[file] ?? 0;
    if (count > was) grown.push({ file, count, was });
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const baseTotal = Object.values(baseline).reduce((a, b) => a + b, 0);

  if (flag('list')) {
    const src = (rel) => readFileSync(join(REPO_ROOT, rel), 'utf8');
    for (const [rel, found] of Object.entries(details)) {
      const text = src(rel);
      for (const f of found) {
        console.log(`  ${rel}:${f.line}  ${JSON.stringify(text.slice(f.start, f.end)).slice(0, 100)}`);
      }
    }
  }

  const byPackage = {};
  for (const [file, count] of Object.entries(counts)) {
    const pkg = packageOf(file);
    byPackage[pkg] = (byPackage[pkg] ?? 0) + count;
  }
  const top = Object.entries(byPackage).sort((a, b) => b[1] - a[1]);
  console.log(`  долг i18n: ${total} строк в ${Object.keys(counts).length} файлах (в снимке ${baseTotal})`);
  console.log('  ' + top.map(([p, c]) => `${p} ${c}`).join(' · '));

  for (const e of errors) console.log(`  ! не разобран: ${e}`);

  if (grown.length) {
    console.log('');
    console.log('  Текст для пользователя написан прямо в коде. Вынесите его в словарь');
    console.log('  (components/i18n/README.md) и замените ключом: шаблон — {{ $t(\'…\') }},');
    console.log('  атрибут — :label="$t(\'…\')", скрипт — t(\'…\'). Не текст интерфейса —');
    console.log('  пометьте строку комментарием `i18n-ignore: причина`.');
    for (const g of grown) {
      console.log(`  ✗ ${g.file}: было ${g.was}, стало ${g.count}`);
      const text = readFileSync(join(REPO_ROOT, g.file), 'utf8');
      for (const f of details[g.file].slice(0, 8)) {
        console.log(`      :${f.line}  ${JSON.stringify(text.slice(f.start, f.end)).slice(0, 90)}`);
      }
    }
    return 1;
  }
  if (total < baseTotal) {
    console.log('  долг снизился — обновите снимок: node scripts/check-i18n.mjs hardcode --update');
  }
  return 0;
}

// ─── словари ────────────────────────────────────────────────────────────────

function isTree(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function flatten(tree, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isTree(v)) flatten(v, key, out);
    else out.set(key, v);
  }
  return out;
}

function branchesOf(keys) {
  const branches = new Set();
  for (const key of keys) {
    const parts = key.split('.');
    for (let i = 1; i < parts.length; i++) branches.add(parts.slice(0, i).join('.'));
  }
  return branches;
}

/** Сводный словарь потребителя: Map(key → { message, file }). */
function loadApp(app, problems) {
  const messages = new Map();
  for (const { file, extension } of dictionariesOf(app)) {
    let tree;
    try {
      tree = JSON.parse(readFileSync(join(REPO_ROOT, file), 'utf8'));
    } catch (e) {
      problems.push(`${file}: не JSON — ${e.message}`);
      continue;
    }
    if (extension) {
      const ns = extensionNamespace(extension);
      for (const top of Object.keys(tree)) {
        if (top !== ns && top !== 'errors') {
          problems.push(`${file}: ключи расширения лежат под «${ns}» (и коды ошибок под «errors»), найден раздел «${top}»`);
        }
      }
      const prefix = ns.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase() + '_';
      for (const code of Object.keys(tree.errors ?? {})) {
        if (!code.startsWith(prefix)) problems.push(`${file}: код ошибки ${code} должен начинаться с ${prefix}`);
      }
    }
    for (const [key, message] of flatten(tree)) {
      if (typeof message !== 'string') {
        problems.push(`${file}: ${key} — сообщение должно быть строкой`);
        continue;
      }
      const prev = messages.get(key);
      if (prev) {
        problems.push(`${key}: объявлен дважды — ${prev.file} и ${file}`);
        continue;
      }
      messages.set(key, { message, file });
    }
  }
  // лист и ветвь с одним именем: `a.b` — сообщение и одновременно `a.b.c`
  const branches = branchesOf(messages.keys());
  for (const key of messages.keys()) {
    if (branches.has(key)) problems.push(`${key}: одновременно сообщение и раздел — ${messages.get(key).file}`);
  }
  return messages;
}

function compileProblems(messages) {
  const problems = [];
  for (const [key, { message, file }] of messages) {
    const errs = [];
    try {
      baseCompile(message, { onError: (e) => errs.push(e.message), location: false });
    } catch (e) {
      errs.push(e.message);
    }
    if (errs.length) problems.push(`${file}: ${key} — не компилируется (${errs[0]}); служебные символы экранируйте: {'@'}, {'{'}, {'|'}`);
  }
  return problems;
}

const CALL_RE = /(?<![\w$])(?:\$t|t|te|tc|tm|lt|i18nT|validationMessage)\(\s*(?:(['"])([^'"\n]+?)\1|`([^`]*)`)/g;
const KEY_PROP_RE = /\b\w*Key\s*[:=]\s*(['"])([a-z][\w-]*(?:\.[\w-]+)+)\1/g;
const ERROR_CODE_RE = /\b(?:DomainError(?:\.\w+)?\(\s*|errorCode\s*[:=]\s*)(['"])([A-Z][A-Z0-9_]+)\1/g;
const KEYLIKE_RE = /(['"`])([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_-]+)+)\1/g;

/** Ссылки на ключи в коде потребителя. */
function collectUsage(app) {
  const exact = new Map(); // key → первый файл:строка
  const dynamic = new Map(); // prefix → файл
  const keyLike = new Set();
  const lineOf = (text, index) => text.slice(0, index).split('\n').length;
  // Примеры вызовов в комментариях (`// t('wallet.x')`, JSDoc) — не ссылки.
  const blankComments = (text) =>
    text.replace(/^([ \t]*)(\/\/-?|\*|\/\*\*?).*$/gm, (line) => line.replace(/[^\n]/g, ' '));
  for (const rel of listScanFiles()) {
    if (appOf(rel) !== app) continue;
    const text = blankComments(readFileSync(join(REPO_ROOT, rel), 'utf8'));
    for (const m of text.matchAll(CALL_RE)) {
      if (m[2]) {
        if (!exact.has(m[2])) exact.set(m[2], `${rel}:${lineOf(text, m.index)}`);
      } else if (m[3] !== undefined) {
        const tpl = m[3];
        const cut = tpl.indexOf('${');
        if (cut === -1) {
          if (!exact.has(tpl)) exact.set(tpl, `${rel}:${lineOf(text, m.index)}`);
        } else {
          const prefix = tpl.slice(0, cut).replace(/\.$/, '');
          if (prefix) dynamic.set(prefix, `${rel}:${lineOf(text, m.index)}`);
        }
      }
    }
    for (const m of text.matchAll(KEY_PROP_RE)) {
      if (!exact.has(m[2])) exact.set(m[2], `${rel}:${lineOf(text, m.index)}`);
    }
    for (const m of text.matchAll(ERROR_CODE_RE)) {
      const key = `errors.${m[2]}`;
      if (!exact.has(key)) exact.set(key, `${rel}:${lineOf(text, m.index)}`);
    }
    for (const m of text.matchAll(KEYLIKE_RE)) keyLike.add(m[2]);
  }
  return { exact, dynamic, keyLike };
}

function glossaryProblems(messages) {
  const path = join(REPO_ROOT, GLOSSARY);
  if (!existsSync(path)) return [];
  const glossary = JSON.parse(readFileSync(path, 'utf8'));
  const problems = [];
  for (const rule of glossary.forbidden ?? []) {
    const re = new RegExp(rule.pattern, 'iu');
    const allow = new Set(rule.allow ?? []);
    for (const [key, { message, file }] of messages) {
      if (re.test(message) && !allow.has(key)) {
        problems.push(`${file}: ${key} — «${message.match(re)[0]}»: ${rule.reason}`);
      }
    }
  }
  return problems;
}

// Словарь, который никто не подключает, в приложение не попадёт: ядро
// контроллера подключает свои явным импортом в src/i18n/index.ts (так сборка
// кладёт их в dist), ядро desktop — через import.meta.glob, расширение —
// импортом своего i18n/<язык>.json в собственном коде.
function unconnectedProblems(app) {
  const problems = [];
  const files = listScanFiles();
  for (const { file, extension } of dictionariesOf(app)) {
    if (file.startsWith('components/i18n/')) continue;
    if (!extension) {
      if (app === 'controller') {
        const index = readFileSync(join(REPO_ROOT, 'components/controller/src/i18n/index.ts'), 'utf8');
        if (!index.includes(`./locales/ru/${basename(file)}`)) {
          problems.push(`${file}: словарь не подключён — добавьте импорт в components/controller/src/i18n/index.ts`);
        }
      }
      continue;
    }
    // Словарь расширения подключает его модуль i18n/index.ts (импорт ./ru.json
    // и регистрация), а сам модуль — точка входа расширения (install.ts на
    // рабочем столе, *.module.ts в контроллере) импортом './i18n'.
    const extDir = file.replace(/\/i18n\/[^/]+$/, '/');
    const indexPath = join(REPO_ROOT, extDir, 'i18n/index.ts');
    const moduleOk =
      existsSync(indexPath) &&
      /from '\.\/ru\.json'/.test(readFileSync(indexPath, 'utf8')) &&
      /registerMessages\(/.test(readFileSync(indexPath, 'utf8'));
    const entryOk = files.some(
      (rel) =>
        rel.startsWith(extDir) &&
        /(^|\/)(install\.ts|[^/]*\.module\.ts)$/.test(rel) &&
        /import '\.\/i18n';/.test(readFileSync(join(REPO_ROOT, rel), 'utf8')),
    );
    const connected = moduleOk && entryOk;
    if (!connected) problems.push(`${file}: словарь не подключён — импортируйте его в коде расширения и зарегистрируйте (registerMessages)`);
  }
  return problems;
}

// Уведомления: шаблоны Liquid в components/notifications/src/i18n/<язык>.json.
// Каждый nt('…') в сценариях есть в словаре, каждый шаблон разбирается Liquid —
// тем же движком, что отрисовывает письма в контроллере.
function notificationProblems() {
  const dictPath = join(REPO_ROOT, 'components/notifications/src/i18n/ru.json');
  if (!existsSync(dictPath)) return { problems: [], size: 0 };
  const problems = [];
  const tree = JSON.parse(readFileSync(dictPath, 'utf8'));
  const leaves = flatten(tree);
  const controllerRequire = createRequire(join(REPO_ROOT, 'components/controller/package.json'));
  const { Liquid } = controllerRequire('liquidjs');
  const liquid = new Liquid({ strictVariables: false, strictFilters: false });
  for (const [key, template] of leaves) {
    try {
      liquid.parse(template);
    } catch (e) {
      problems.push(`components/notifications/src/i18n/ru.json: ${key} — шаблон не разбирается Liquid (${e.message.split('\n')[0]})`);
    }
  }
  for (const rel of listScanFiles().filter((f) => f.startsWith('components/notifications/src/'))) {
    const text = readFileSync(join(REPO_ROOT, rel), 'utf8');
    for (const m of text.matchAll(/\bnt\(\s*'([^']+)'/g)) {
      if (!leaves.has(m[1])) problems.push(`${rel}: текста уведомления «${m[1]}» нет в словаре`);
    }
  }
  return { problems, size: leaves.size };
}

// SSR-сервер (src-ssr) и сервис-воркер собираются esbuild, без Vite:
// import.meta.glob словарей там не работает, и импорт переводчика приложения
// роняет сервер при старте. Их строки — значения по умолчанию из окружения
// и служебные уведомления, помечаются i18n-ignore.
function standaloneBundleProblems() {
  const problems = [];
  for (const rel of listScanFiles()) {
    if (!/^components\/desktop\/(src-ssr\/|src-pwa\/(custom-service-worker|network-utils))/.test(rel)) continue;
    if (/from 'src\/shared\/i18n'/.test(readFileSync(join(REPO_ROOT, rel), 'utf8'))) {
      problems.push(`${rel}: собирается без Vite — переводчик приложения (src/shared/i18n) здесь недоступен`);
    }
  }
  return problems;
}

function gateCatalog() {
  let failed = 0;
  for (const p of standaloneBundleProblems()) {
    console.log(`    ✗ ${p}`);
    failed = 1;
  }
  {
    const { problems, size } = notificationProblems();
    if (size) console.log(`  notifications: ${size} шаблонов`);
    for (const p of problems) console.log(`    ✗ ${p}`);
    if (problems.length) failed = 1;
  }
  for (const app of ['desktop', 'controller']) {
    const problems = [];
    const messages = loadApp(app, problems);
    problems.push(...unconnectedProblems(app));
    problems.push(...compileProblems(messages));
    problems.push(...glossaryProblems(messages));

    const { exact, dynamic, keyLike } = collectUsage(app);
    const keys = new Set(messages.keys());
    const branches = branchesOf(keys);
    for (const [key, where] of exact) {
      if (!keys.has(key)) problems.push(`${where}: ключа «${key}» нет в словаре`);
    }
    for (const [prefix, where] of dynamic) {
      if (!branches.has(prefix)) problems.push(`${where}: раздела «${prefix}.*» нет в словаре`);
    }

    const unused = [...keys].filter(
      (k) =>
        !exact.has(k) &&
        !keyLike.has(k) &&
        !k.startsWith('common.') &&
        !k.startsWith('validation.') &&
        !k.startsWith('errors.') &&
        ![...dynamic.keys()].some((p) => k.startsWith(p + '.')),
    );

    console.log(`  ${app}: ${keys.size} сообщений, ссылок ${exact.size}, собранных в рантайме ${dynamic.size}`);
    if (unused.length) {
      console.log(`    справка: без ссылок в коде ${unused.length} (${unused.slice(0, 5).join(', ')}${unused.length > 5 ? ', …' : ''})`);
    }
    for (const p of problems) console.log(`    ✗ ${p}`);
    if (problems.length) failed = 1;
  }
  return failed;
}

// ─── типы ключей ────────────────────────────────────────────────────────────

function renderKeyTypes(app) {
  const problems = [];
  const messages = loadApp(app, problems);
  const keys = [...messages.keys()].sort();
  const branches = [...branchesOf(keys)].sort();
  const union = (list) => (list.length ? list.map((k) => `  | '${k}'`).join('\n') : '  never');
  return [
    '// Сгенерировано `node scripts/check-i18n.mjs types --write` из словарей — не править руками.',
    '// Опечатка в ключе t(\'…\') становится ошибкой типов; ключ, собранный в рантайме,',
    '// обязан начинаться с существующего раздела: t(`capital.issue.status.${status}`).',
    '',
    '/* eslint-disable */',
    'export type MessageKey =',
    union(keys) + ';',
    '',
    'export type MessageBranch =',
    union(branches) + ';',
    '',
    'export type DynamicMessageKey = `${MessageBranch}.${string}`;',
    '',
  ].join('\n');
}

function gateTypes() {
  let failed = 0;
  for (const [app, rel] of Object.entries(KEY_TYPES)) {
    const path = join(REPO_ROOT, rel);
    const expected = renderKeyTypes(app);
    if (flag('write')) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, expected);
      console.log(`  записано: ${rel}`);
      continue;
    }
    if (!existsSync(dirname(path))) continue; // потребитель ещё не подключён
    const actual = existsSync(path) ? readFileSync(path, 'utf8') : '';
    if (actual !== expected) {
      console.log(`  ✗ ${rel} отстал от словарей — node scripts/check-i18n.mjs types --write`);
      failed = 1;
    } else {
      console.log(`  ${basename(rel)} (${app}) совпадает со словарями`);
    }
  }
  return failed;
}

// ─── запуск ─────────────────────────────────────────────────────────────────

function sortObject(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}

const gates = { hardcode: gateHardcode, catalog: gateCatalog, types: gateTypes };
let code = 0;
if (mode === 'all') {
  for (const [name, gate] of Object.entries(gates)) {
    console.log(`  [${name}]`);
    code |= gate();
  }
} else if (gates[mode]) {
  code = gates[mode]();
} else {
  console.error(`неизвестная проверка: ${mode} (hardcode | catalog | types)`);
  code = 2;
}
process.exit(code);
