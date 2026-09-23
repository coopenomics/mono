#!/usr/bin/env node
// Перенос текста из кода в словари i18n.
//
// Работает в три шага, и только первый и последний меняют что-то на диске:
//
//   scan  <пути…> --out work.json
//     Находит текст для пользователя (тем же сканером, что и гейт) и пишет
//     список: файл, строка, текст с плейсхолдерами {0},{1} вместо выражений,
//     сами выражения, окружение строки и подсказку области ключа.
//     Строки, где механическая замена меняет смысл (сравнение, case, ключ
//     объекта, член enum, строковая операция), помечаются auto:false и
//     остаются для ручного разбора.
//
//   (имена)  names.json: { "<id>": { "key": "wallet.deposit.submit",
//                                   "params": ["amount"] }
//                        | { "ignore": "причина" } | { "skip": "причина" } }
//     Смысловые ключи по конвенции components/i18n/README.md. Этот шаг
//     делает человек или модель — код он не трогает.
//
//   apply work.json names.json
//     Заменяет текст ключами (шаблон — $t, скрипт — t, отказ бэкенда —
//     DomainError), дописывает словари, ставит импорты, подключает словарь
//     расширения. Проверяет формат ключа, область, повтор ключа с другим
//     текстом и число параметров; спорное пропускает с причиной в отчёте.
//
// После apply: `node scripts/check-i18n.mjs types --write`, eslint по
// изменённым файлам, `node scripts/check-i18n.mjs` и снимок долга.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, basename, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { REPO_ROOT, SCAN_EXCLUDE, extensionNamespace } from './lib/i18n-config.mjs';
import { scanFile, CYRILLIC, normalizeText } from './lib/i18n-scan.mjs';

const require = createRequire(join(REPO_ROOT, 'package.json'));
const ts = require('typescript');

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

// ─── области и словари ──────────────────────────────────────────────────────

const camel = (s) => s.replace(/[-_ ]+([a-zA-Z0-9])/g, (_, c) => c.toUpperCase()).replace(/^[A-Z]/, (c) => c.toLowerCase());
const RESERVED = new Set(['common', 'validation', 'errors']);

/** Кто владеет файлом и куда пишутся его ключи. */
function ownerOf(rel) {
  let m = /^components\/desktop\/extensions\/([^/]+)\//.exec(rel);
  if (m) return { app: 'desktop', ext: m[1], ns: extensionNamespace(m[1]), extRoot: `components/desktop/extensions/${m[1]}` };
  m = /^components\/controller\/src\/extensions\/([^/]+)\//.exec(rel);
  if (m) return { app: 'controller', ext: m[1], ns: extensionNamespace(m[1]), extRoot: `components/controller/src/extensions/${m[1]}` };
  // Клиентские библиотеки: тексты — в словарях пакета @coopenomics/i18n,
  // перевод — lt() (переводчик приложения или словари пакета).
  m = /^components\/(auth|sdk)\/src\//.exec(rel);
  if (m) {
    const ns = m[1] === 'auth' ? 'authClient' : 'sdkClient';
    return { app: 'lib', ns, lib: true, dict: `components/i18n/src/messages/ru/${ns}.json` };
  }
  // Каркас расширений: работает на сервере, отказы — DomainError, тексты — в
  // словаре пакета kit.json; DomainError берётся из самого каркаса.
  if (rel.startsWith('components/extension-kit/src/')) {
    return { app: 'controller', kit: true, ns: 'kit', dict: 'components/i18n/src/messages/ru/kit.json' };
  }
  if (rel.startsWith('components/desktop/')) return { app: 'desktop' };
  if (rel.startsWith('components/controller/')) return { app: 'controller' };
  return { app: 'other' };
}

/** Подсказка области ключа по пути FSD — модель вправе выбрать точнее. */
function domainHint(rel) {
  const o = ownerOf(rel);
  if (o.ns) return o.ns;
  let m = /components\/desktop\/src\/(pages|features|widgets|entities)\/([^/]+)\//.exec(rel);
  if (m) return camel(m[2]);
  m = /components\/desktop\/src\/processes\/([^/]+)\//.exec(rel);
  if (m) return camel(m[1]);
  if (/components\/desktop\/src\/shared\/ui\//.test(rel)) return 'ui';
  m = /components\/desktop\/src\/shared\/lib\/([^/.]+)/.exec(rel);
  if (m) return camel(m[1]);
  if (/components\/desktop\/src\/shared\/api\//.test(rel)) return 'api';
  if (/components\/desktop\/src\/desktops\//.test(rel)) return 'desktop';
  if (/components\/desktop\//.test(rel)) return 'app';
  m = /components\/controller\/src\/(?:application|domain|infrastructure)\/([^/]+)\//.exec(rel);
  if (m) return camel(m[1]);
  return 'app';
}

function componentHint(rel) {
  const name = basename(rel, extname(rel)).replace(/\.(vue|ts)$/, '');
  return camel(name === 'index' ? basename(dirname(rel)) : name);
}

function dictionaryFor(owner, key) {
  const first = key.split('.')[0];
  if (owner.lib || owner.kit) return owner.dict;
  if (owner.app === 'desktop') {
    return owner.ext
      ? `${owner.extRoot}/i18n/ru.json`
      : `components/desktop/src/shared/i18n/locales/ru/${first}.json`;
  }
  if (owner.app === 'controller') {
    return owner.ext
      ? `${owner.extRoot}/i18n/ru.json`
      : `components/controller/src/i18n/locales/ru/${first}.json`;
  }
  return undefined;
}

// ─── текст сообщения ────────────────────────────────────────────────────────

const ENTITIES = { nbsp: ' ', laquo: '«', raquo: '»', mdash: '—', ndash: '–', quot: '"', apos: "'", amp: '&', lt: '<', gt: '>', hellip: '…', times: '×', minus: '−', rarr: '→', larr: '←', thinsp: ' ', shy: '­', bull: '•', middot: '·', copy: '©', deg: '°', le: '≤', ge: '≥' };

function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (all, name) => {
    if (name[0] === '#') {
      const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : all;
    }
    return ENTITIES[name.toLowerCase()] ?? all;
  });
}

/** Служебные символы vue-i18n в обычном тексте — литералом. */
function escapeMessage(s) {
  return s.replace(/[{}@|]/g, (c) => `{'${c}'}`);
}

/**
 * Разбор текста находки в сообщение: статические части и выражения.
 * Возвращает { parts: [{text}|{expr}], template: 'Текст {0} текст' }.
 */
function partsOf(f, src) {
  if (f.kind === 'tpl-text') {
    const parts = [];
    let last = 0;
    for (const m of f.text.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
      parts.push({ text: f.text.slice(last, m.index) });
      parts.push({ expr: m[1].trim() });
      last = m.index + m[0].length;
    }
    parts.push({ text: f.text.slice(last) });
    return parts.map((p) => (p.text !== undefined ? { text: decodeEntities(p.text) } : p));
  }
  if (f.kind === 'tpl-attr') return [{ text: decodeEntities(f.text) }];
  if (f.parts) return f.parts;
  return [{ text: f.text }];
}

function previewOf(parts) {
  let i = 0;
  return parts
    .map((p) => (p.text !== undefined ? p.text : `{${i++}}`))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Текст сообщения. Текст шаблона сжимается так же, как его сжимает Vue
 * (пробелы и переносы — в один пробел, края остаются снаружи {{ }}); строки
 * скриптов и атрибутов переносятся как есть — ведущий пробел в ' (пауза)' и
 * перенос строки в подсказке значимы.
 */
function messageOf(parts, names, condense = false) {
  let i = 0;
  const raw = parts.map((p) => (p.text !== undefined ? escapeMessage(p.text) : `{${names[i++]}}`)).join('');
  return condense ? raw.replace(/\s+/g, ' ').trim() : raw;
}

// ─── scan ───────────────────────────────────────────────────────────────────

const MANUAL = {
  compare: 'сравнение со строкой — логика, замена ключом меняет смысл',
  case: 'ветка switch по строке — логика',
  enum: 'значение enum — данные, не надпись',
  propName: 'ключ объекта — данные',
  index: 'обращение по строковому ключу',
  stringOp: 'строковая операция (includes/startsWith/…) — логика',
};

function listFiles(paths) {
  const out = [];
  const walk = (abs) => {
    const st = statSync(abs);
    if (st.isDirectory()) {
      for (const e of readdirSync(abs)) if (e !== 'node_modules' && !e.startsWith('.')) walk(join(abs, e));
    } else if (/\.(vue|ts|js)$/.test(abs)) out.push(abs);
  };
  for (const p of paths) walk(join(REPO_ROOT, p));
  return out
    .map((a) => relative(REPO_ROOT, a))
    .filter((rel) => !SCAN_EXCLUDE.some((re) => re.test('/' + rel)))
    .sort();
}

function scanCommand() {
  const paths = args.slice(1).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--out');
  const out = opt('out') ?? 'i18n-work.json';
  const files = [];
  let total = 0;
  let manual = 0;
  for (const rel of listFiles(paths)) {
    const src = readFileSync(join(REPO_ROOT, rel), 'utf8');
    const { found } = scanFile(join(REPO_ROOT, rel));
    const counted = found.filter((f) => !f.excluded);
    if (!counted.length) continue;
    const lines = src.split('\n');
    const items = counted.map((f, n) => {
      const parts = partsOf(f, src);
      const exprs = parts.filter((p) => p.expr !== undefined).map((p) => p.expr);
      const item = {
        id: `${rel}#${n}`,
        line: f.line,
        kind: f.kind,
        text: previewOf(parts),
        ...(exprs.length && { exprs }),
        ...(f.attr && { attr: f.attr }),
        context: lines.slice(Math.max(0, f.line - 3), f.line + 2).map((l) => l.slice(0, 160)).join('\n'),
      };
      if (f.newCallee && /Exception$|^HttpApiError$|^Error$|^DomainError$/.test(f.newCallee)) item.error = f.newCallee;
      if (f.context && MANUAL[f.context]) {
        item.auto = false;
        item.reason = MANUAL[f.context];
        manual++;
      }
      return item;
    });
    total += items.length;
    const owner = ownerOf(rel);
    files.push({
      file: rel,
      app: owner.app,
      ...(owner.ext && { extension: owner.ext, namespace: owner.ns }),
      domainHint: domainHint(rel),
      componentHint: componentHint(rel),
      sha: createHash('sha1').update(src).digest('hex').slice(0, 12),
      items,
    });
  }
  writeFileSync(out, JSON.stringify({ created: new Date().toISOString(), files }, null, 1) + '\n');
  console.log(`scan: ${files.length} файлов, ${total} строк, из них вручную ${manual} → ${out}`);
}

// ─── правка кода ────────────────────────────────────────────────────────────

const KEY_RE = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_]+)+$/;
const CODE_RE = /^[A-Z][A-Z0-9_]+$/;
const PARAM_RE = /^[a-z][A-Za-z0-9_]*$/;

const EXCEPTION_FACTORY = {
  BadRequestException: 'badRequest',
  NotFoundException: 'notFound',
  ForbiddenException: 'forbidden',
  ConflictException: 'conflict',
  UnauthorizedException: 'unauthorized',
  UnprocessableEntityException: 'unprocessable',
  InternalServerErrorException: 'internal',
  NotAcceptableException: 'badRequest',
  PreconditionFailedException: 'conflict',
  GoneException: 'notFound',
  Error: 'internal',
};

const STATUS_FACTORY = {
  400: 'badRequest', BAD_REQUEST: 'badRequest',
  401: 'unauthorized', UNAUTHORIZED: 'unauthorized',
  403: 'forbidden', FORBIDDEN: 'forbidden',
  404: 'notFound', NOT_FOUND: 'notFound',
  409: 'conflict', CONFLICT: 'conflict',
  422: 'unprocessable', UNPROCESSABLE_ENTITY: 'unprocessable',
  429: 'tooManyRequests', TOO_MANY_REQUESTS: 'tooManyRequests',
  500: 'internal', INTERNAL_SERVER_ERROR: 'internal',
};

function factoryForStatus(expr) {
  const m = /(\d{3})|\.([A-Z_]+)$/.exec(expr.trim());
  if (!m) return undefined;
  return STATUS_FACTORY[m[1] ?? m[2]];
}

/** Объявлен ли в файле собственный идентификатор `t` — тогда импорт под другим именем. */
function declaresT(code) {
  const sf = ts.createSourceFile('x.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let found = false;
  const visit = (node) => {
    if (found) return;
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isFunctionDeclaration(node) || ts.isBindingElement(node)) && node.name && ts.isIdentifier(node.name) && node.name.text === 't') found = true;
    if (ts.isImportSpecifier(node) && node.name.text === 't') found = true;
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** Вставить именованный импорт в блок кода (или дополнить существующий). */
function ensureImport(code, name, from) {
  const sf = ts.createSourceFile('x.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  // Новый импорт — сразу за первым сплошным блоком импортов: в CommonJS
  // (контроллер) require выполняется в порядке текста, и импорт после кода,
  // который уже зовёт t() при загрузке модуля, дал бы TDZ-ошибку.
  let lastImportEnd = -1;
  let leadingBlock = true;
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st)) {
      leadingBlock = false;
      continue;
    }
    if (leadingBlock) lastImportEnd = st.getEnd();
    const spec = st.moduleSpecifier.text;
    const named = st.importClause?.namedBindings;
    if (spec === from && named && ts.isNamedImports(named) && !st.importClause.isTypeOnly) {
      const names = named.elements.map((e) => e.getText(sf));
      const bare = name.split(' as ').pop();
      if (named.elements.some((e) => e.name.text === bare)) return code;
      names.push(name);
      const replacement = `{ ${names.join(', ')} }`;
      return code.slice(0, named.getStart(sf)) + replacement + code.slice(named.getEnd());
    }
  }
  const line = `import { ${name} } from '${from}';`;
  if (lastImportEnd >= 0) return code.slice(0, lastImportEnd) + '\n' + line + code.slice(lastImportEnd);
  const lead = code.match(/^\s*/)[0];
  return lead + line + '\n' + code.slice(lead.length);
}

/** Убрать из импортов имена, которые больше нигде в файле не встречаются. */
function dropUnusedImports(code, names, from) {
  const sf = ts.createSourceFile('x.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let out = code;
  for (const st of [...sf.statements].reverse()) {
    if (!ts.isImportDeclaration(st) || st.moduleSpecifier.text !== from) continue;
    const named = st.importClause?.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    const rest = code.slice(0, st.getStart(sf)) + code.slice(st.getEnd());
    const used = (n) => new RegExp(`(?<![\\w$])${n}(?![\\w$])`).test(rest);
    const keep = named.elements.filter((e) => !names.includes(e.name.text) || used(e.name.text));
    if (keep.length === named.elements.length) continue;
    let replacement;
    if (keep.length) {
      replacement = code.slice(st.getStart(sf), named.getStart(sf)) + `{ ${keep.map((e) => e.getText(sf)).join(', ')} }` + code.slice(named.getEnd(), st.getEnd());
      out = out.slice(0, st.getStart(sf)) + replacement + out.slice(st.getEnd());
    } else if (st.importClause.name) {
      replacement = `import ${st.importClause.name.text} from '${from}';`;
      out = out.slice(0, st.getStart(sf)) + replacement + out.slice(st.getEnd());
    } else {
      const endWithNewline = out[st.getEnd()] === '\n' ? st.getEnd() + 1 : st.getEnd();
      out = out.slice(0, st.getStart(sf)) + out.slice(endWithNewline);
    }
  }
  return out;
}

function writeJsonSorted(path, tree) {
  const sort = (x) =>
    Array.isArray(x)
      ? x.map(sort)
      : typeof x === 'object' && x !== null
        ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sort(x[k])]))
        : x;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(sort(tree), null, 2) + '\n');
}

function getLeaf(tree, key) {
  let node = tree;
  for (const p of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = node[p];
  }
  return node;
}

function setLeaf(tree, key, value) {
  const parts = key.split('.');
  let node = tree;
  for (const p of parts.slice(0, -1)) {
    if (node[p] === undefined) node[p] = {};
    if (typeof node[p] !== 'object') return false;
    node = node[p];
  }
  const last = parts[parts.length - 1];
  if (typeof node[last] === 'object') return false;
  node[last] = value;
  return true;
}

/** Модуль словаря расширения: регистрирует словарь и отдаёт t. */
function ensureExtensionModule(owner, created) {
  const indexPath = join(REPO_ROOT, owner.extRoot, 'i18n', 'index.ts');
  if (existsSync(indexPath)) return;
  mkdirSync(dirname(indexPath), { recursive: true });
  if (owner.app === 'desktop') {
    writeFileSync(
      indexPath,
      `/**
 * Словарь расширения «${owner.ext}». Регистрируется при первом импорте —
 * раньше, чем выполнится любой код расширения, берущий текст через t().
 * Шаблоны пользуются глобальным $t; словарь подключает install.ts.
 */
import { registerMessages } from 'src/shared/i18n';
import ru from './ru.json';

registerMessages('extension:${owner.ext}', ru);

export { t, te } from 'src/shared/i18n';
`,
    );
    // Импорт './i18n' в install.ts ставится в конце apply (connectEntries):
    // install.ts может сам быть в порции, и его запись затёрла бы импорт.
  } else {
    writeFileSync(
      indexPath,
      `/**
 * Словарь расширения «${owner.ext}». Регистрируется при первом импорте;
 * модуль расширения импортирует этот файл, поэтому словарь готов раньше,
 * чем расширение бросит первый отказ или соберёт первую надпись.
 */
import { registerMessages } from '@coopenomics/i18n/server';
import ru from './ru.json';

registerMessages('ru', ru, 'extension:${owner.ext}');

export { t, te, currentLocale } from '@coopenomics/i18n/server';
`,
    );
    // Импорт './i18n' в модуль расширения — в конце apply (connectEntries).
  }
  created.push(relative(REPO_ROOT, indexPath));
}

function relImport(fromRel, toRel) {
  let r = relative(dirname(fromRel), toRel).replace(/\\/g, '/');
  if (!r.startsWith('.')) r = './' + r;
  return r;
}

function applyCommand() {
  const work = JSON.parse(readFileSync(args[1], 'utf8'));
  const names = JSON.parse(readFileSync(args[2], 'utf8'));
  const dicts = new Map(); // path → tree
  const loadDict = (rel) => {
    if (!dicts.has(rel)) {
      const abs = join(REPO_ROOT, rel);
      dicts.set(rel, existsSync(abs) ? JSON.parse(readFileSync(abs, 'utf8')) : {});
    }
    return dicts.get(rel);
  };
  const report = { applied: 0, ignored: 0, skipped: [], files: new Set(), dicts: new Set(), created: [] };
  const allowlistPath = join(REPO_ROOT, 'scripts/lib/i18n-ignore.json');
  const allowlist = existsSync(allowlistPath) ? JSON.parse(readFileSync(allowlistPath, 'utf8')) : {};
  const coreControllerDicts = new Set();

  for (const entry of work.files) {
    const rel = entry.file;
    const abs = join(REPO_ROOT, rel);
    let src = readFileSync(abs, 'utf8');
    const { found } = scanFile(abs);
    const counted = found.filter((f) => !f.excluded);
    const owner = ownerOf(rel);
    const edits = []; // { start, end, text, block? }
    const scriptNeedsT = new Set(); // смещение начала блока скрипта
    let needsDomainError = false;
    let needsHttpStatus = false;
    const droppedExceptions = new Set();

    const isVue = rel.endsWith('.vue');
    let blocks = [{ start: 0, end: src.length }];
    if (isVue) {
      const { parse } = require('@vue/compiler-sfc');
      const { descriptor } = parse(src, { filename: rel });
      blocks = [descriptor.script, descriptor.scriptSetup].filter(Boolean).map((b) => ({ start: b.loc.start.offset, end: b.loc.end.offset }));
    }
    const blockOf = (offset) => blocks.find((b) => offset >= b.start && offset <= b.end);
    const tName = (() => {
      if (owner.lib) return 'lt';
      const scripts = blocks.map((b) => src.slice(b.start, b.end)).join('\n');
      return declaresT(scripts) ? 'i18nT' : 't';
    })();

    for (const item of entry.items) {
      const decision = names[item.id];
      if (!decision) continue;
      const n = Number(item.id.split('#').pop());
      const f = counted[n];
      const skip = (why) => report.skipped.push(`${item.id} (${item.text.slice(0, 40)}): ${why}`);
      if (!f || previewOf(partsOf(f, src)) !== item.text) {
        skip('файл изменился со времени scan — пересканируйте');
        continue;
      }
      if (decision.skip) {
        skip(decision.skip);
        continue;
      }
      if (decision.ignore) {
        if (f.origin === 'template') {
          (allowlist[rel] ??= []).push({ text: normalizeText(f.text), reason: decision.ignore });
        } else {
          const lineStart = src.lastIndexOf('\n', f.start - 1) + 1;
          const indent = src.slice(lineStart).match(/^[ \t]*/)[0];
          edits.push({ start: lineStart, end: lineStart, text: `${indent}// i18n-ignore: ${decision.ignore}\n` });
        }
        report.ignored++;
        continue;
      }
      if (item.auto === false) {
        skip(item.reason);
        continue;
      }

      const parts = partsOf(f, src);
      const exprs = parts.filter((p) => p.expr !== undefined).map((p) => p.expr);
      const paramNames = decision.params ?? exprs.map((_, i) => `p${i}`);
      if (paramNames.length !== exprs.length || !paramNames.every((p) => PARAM_RE.test(p)) || new Set(paramNames).size !== paramNames.length) {
        skip(`параметры ${JSON.stringify(paramNames)} не сходятся с выражениями ${JSON.stringify(exprs)}`);
        continue;
      }
      const paramsObj = exprs.length ? `, { ${exprs.map((e, i) => (e === paramNames[i] ? e : `${paramNames[i]}: ${e}`)).join(', ')} }` : '';

      // Отказ бэкенда: new XException('текст') → DomainError.x('КОД')
      const STATUS_CLASS = { BadGatewayException: 'BAD_GATEWAY', ServiceUnavailableException: 'SERVICE_UNAVAILABLE', GatewayTimeoutException: 'GATEWAY_TIMEOUT' };
      const isError =
        owner.app === 'controller' &&
        f.origin !== 'template' &&
        f.newCallee &&
        ((EXCEPTION_FACTORY[f.newCallee] && f.argIndex === 0 && f.newArgs === 1) ||
          (STATUS_CLASS[f.newCallee] && f.argIndex === 0 && f.newArgs === 1) ||
          (f.newCallee === 'HttpException' && f.argIndex === 0 && f.newArgs === 2) ||
          (f.newCallee === 'HttpApiError' && f.argIndex === 1 && f.newArgs === 2));
      let key = decision.key;
      if (isError) {
        const code = decision.code ?? (key?.startsWith('errors.') ? key.slice(7) : undefined);
        if (!code || !CODE_RE.test(code)) {
          skip(`для отказа нужен код SCREAMING_SNAKE, получено ${decision.code ?? key}`);
          continue;
        }
        if (owner.ns && !code.startsWith(owner.ns.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase() + '_')) {
          skip(`код ${code} расширения должен начинаться с префикса расширения`);
          continue;
        }
        let factory = f.newCallee === 'HttpApiError' ? factoryForStatus(f.statusExpr ?? '') : EXCEPTION_FACTORY[f.newCallee];
        // Статус без своей фабрики — конструктор DomainError со статусом.
        let statusArg;
        if (STATUS_CLASS[f.newCallee]) statusArg = `HttpStatus.${STATUS_CLASS[f.newCallee]}`;
        if (f.newCallee === 'HttpException') statusArg = src.slice(f.newStart, f.newEnd).replace(/^new\s+HttpException\(/, '').split(',').slice(1).join(',').replace(/\)\s*$/, '').trim();
        if (f.newCallee === 'HttpApiError' && !factory) statusArg = f.statusExpr;
        if (!factory && !statusArg) {
          skip(`не разобран статус ${f.newCallee}`);
          continue;
        }
        key = `errors.${code}`;
        const dictDomain = decision.dict ?? item.domainHint ?? entry.domainHint;
        const dictRel = owner.kit
          ? owner.dict
          : owner.ext
            ? `${owner.extRoot}/i18n/ru.json`
            : `components/controller/src/i18n/locales/ru/${dictDomain}.json`;
        const message = messageOf(parts, paramNames);
        const tree = loadDict(dictRel);
        const prev = getLeaf(tree, key);
        if (prev !== undefined && prev !== message) {
          skip(`код ${code} уже занят другим текстом: «${prev}»`);
          continue;
        }
        setLeaf(tree, key, message);
        report.dicts.add(dictRel);
        if (!owner.ext && !owner.kit) coreControllerDicts.add(dictDomain);
        const paramsArg = exprs.length ? `, { ${exprs.map((e, i) => (e === paramNames[i] ? e : `${paramNames[i]}: ${e}`)).join(', ')} }` : '';
        if (statusArg && !factory) {
          edits.push({ start: f.newStart, end: f.newEnd, text: `new DomainError('${code}', ${exprs.length ? paramsArg.slice(2) : '{}'}, ${statusArg})` });
          if (statusArg.startsWith('HttpStatus.')) needsHttpStatus = true;
        } else {
          edits.push({ start: f.newStart, end: f.newEnd, text: `DomainError.${factory}('${code}'${paramsArg})` });
        }
        needsDomainError = true;
        droppedExceptions.add(f.newCallee);
        report.applied++;
        continue;
      }

      // Отказ в desktop (throw new Error('…')) размечен кодом: ключ — <область>.error.<код>.
      if ((owner.app === 'desktop' || owner.lib) && (decision.code || key?.startsWith('errors.'))) {
        const code = decision.code ?? key.slice(7);
        const domain = owner.ns ?? decision.dict ?? entry.domainHint;
        const prefix = domain.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase() + '_';
        const stripped = code.startsWith(prefix) ? code.slice(prefix.length) : code;
        key = `${domain}.error.${stripped.toLowerCase().replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())}`;
      }
      if (!key || !KEY_RE.test(key)) {
        skip(`ключ «${key}» не по конвенции`);
        continue;
      }
      const first = key.split('.')[0];
      if (owner.ns && first !== owner.ns && first !== 'common') {
        skip(`ключ расширения должен начинаться с «${owner.ns}.»`);
        continue;
      }
      if (!owner.ns && (RESERVED.has(first) && !key.startsWith('common.'))) {
        skip(`раздел «${first}» принадлежит пакету @coopenomics/i18n`);
        continue;
      }
      const message = messageOf(parts, paramNames, f.kind === 'tpl-text');
      if (!CYRILLIC.test(message)) {
        skip('после сборки сообщения не осталось текста');
        continue;
      }
      if (key.startsWith('common.')) {
        // общий ключ пакета: разрешён, только если текст совпадает
        const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'components/i18n/src/messages/ru/common.json'), 'utf8'));
        if (getLeaf(pkg, key) !== message) {
          skip(`общий ключ ${key} с другим текстом`);
          continue;
        }
      } else {
        const dictRel = dictionaryFor(owner, key);
        if (!dictRel) {
          skip('не определён словарь');
          continue;
        }
        const tree = loadDict(dictRel);
        const prev = getLeaf(tree, key);
        if (prev !== undefined && prev !== message) {
          skip(`ключ ${key} уже занят другим текстом: «${prev}»`);
          continue;
        }
        if (!setLeaf(tree, key, message)) {
          skip(`ключ ${key} конфликтует с разделом словаря`);
          continue;
        }
        report.dicts.add(dictRel);
        if (owner.app === 'controller' && !owner.ext && !owner.kit) coreControllerDicts.add(first);
      }

      // Замена в коде
      if (f.kind === 'tpl-text') {
        const lead = f.text.match(/^\s*/)[0];
        const trail = f.text.match(/\s*$/)[0];
        edits.push({ start: f.start, end: f.end, text: `${lead}{{ $t('${key}'${paramsObj}) }}${trail}` });
      } else if (f.kind === 'tpl-attr') {
        const raw = src.slice(f.valueStart, f.valueEnd);
        const q = raw[0] === "'" || raw[0] === '"' ? raw[0] : '"';
        const iq = q === '"' ? "'" : '"';
        edits.push({ start: f.start, end: f.end, text: `:${f.attr}=${q}$t(${iq}${key}${iq})${q}` });
      } else if (f.origin === 'template') {
        const q = f.quote === '`' ? '`' : f.quote;
        edits.push({ start: f.start, end: f.end, text: `$t(${q}${key}${q}${paramsObj})` });
      } else {
        edits.push({ start: f.start, end: f.end, text: `${tName}('${key}'${paramsObj})` });
        const block = blockOf(f.start);
        if (block) scriptNeedsT.add(block.start);
      }
      report.applied++;
    }

    if (!edits.length) continue;
    edits.sort((a, b) => b.start - a.start);
    for (const e of edits) src = src.slice(0, e.start) + e.text + src.slice(e.end);

    // Импорты. Блоки скрипта сдвинулись — ищем их заново.
    const importFrom = (() => {
      if (owner.lib) return '@coopenomics/i18n';
      if (owner.app === 'desktop') return owner.ext ? relImport(rel, `${owner.extRoot}/i18n`) : 'src/shared/i18n';
      if (owner.kit) return '@coopenomics/i18n/server';
      if (owner.app === 'controller') return owner.ext ? relImport(rel, `${owner.extRoot}/i18n`) : '~/i18n';
      return undefined;
    })();
    const patchBlocks = (fn) => {
      if (!isVue) {
        src = fn(src);
        return;
      }
      const { parse } = require('@vue/compiler-sfc');
      const { descriptor } = parse(src, { filename: rel });
      const target = [descriptor.scriptSetup, descriptor.script].filter(Boolean);
      const b = target.find((x) => /\bt\(|i18nT\(/.test(x.content)) ?? target[0];
      if (!b) return;
      const content = fn(b.content);
      src = src.slice(0, b.loc.start.offset) + content + src.slice(b.loc.end.offset);
    };
    if (scriptNeedsT.size && importFrom) {
      const spec = tName === 'i18nT' ? 't as i18nT' : tName;
      patchBlocks((code) => ensureImport(code, spec, importFrom));
    }
    if (needsDomainError) {
      patchBlocks((code) => {
        const domainErrorFrom = owner.kit ? relImport(rel, 'components/extension-kit/src/errors/domain-error') : '@coopenomics/extension-kit';
        let c = ensureImport(code, 'DomainError', domainErrorFrom);
        if (needsHttpStatus) c = ensureImport(c, 'HttpStatus', '@nestjs/common');
        c = dropUnusedImports(c, [...droppedExceptions], '@nestjs/common');
        c = dropUnusedImports(c, [...droppedExceptions], '@coopenomics/extension-kit');
        return c;
      });
    }
    if (owner.ext && report.dicts.size) ensureExtensionModule(owner, report.created);
    writeFileSync(abs, src);
    report.files.add(rel);
  }

  for (const [rel, tree] of dicts) writeJsonSorted(join(REPO_ROOT, rel), tree);

  // Точка входа расширения импортирует его словарь — после записи всех файлов.
  for (const extRoot of new Set([...report.dicts].map((d) => d.replace(/\/i18n\/ru\.json$/, '')).filter((d) => d.includes('/extensions/')))) {
    const abs = join(REPO_ROOT, extRoot);
    const entry = existsSync(join(abs, 'install.ts'))
      ? join(abs, 'install.ts')
      : readdirSync(abs).filter((f) => /\.module\.ts$/.test(f)).map((f) => join(abs, f))[0];
    if (!entry) continue;
    const code = readFileSync(entry, 'utf8');
    if (!code.includes("import './i18n';")) writeFileSync(entry, `import './i18n';\n` + code);
  }
  if (Object.keys(allowlist).length) writeJsonSorted(allowlistPath, allowlist);

  // Словари ядра контроллера подключаются явным импортом.
  if (coreControllerDicts.size) {
    const indexPath = join(REPO_ROOT, 'components/controller/src/i18n/index.ts');
    let code = readFileSync(indexPath, 'utf8');
    for (const domain of [...coreControllerDicts].sort()) {
      const file = `./locales/ru/${domain}.json`;
      if (code.includes(`'${file}'`)) continue;
      const ident = camel(domain) + 'Dictionary';
      code = code.replace(/(import [^\n]+ from '\.\/locales\/ru\/[^']+';\n)(?![\s\S]*import [^\n]+ from '\.\/locales)/, `$1import ${ident} from '${file}';\n`);
      code = code.replace(/(const CORE_DICTIONARIES[^=]*= \[\n)/, `$1  ['${domain}', ${ident}],\n`);
    }
    writeFileSync(indexPath, code);
  }

  console.log(`apply: заменено ${report.applied}, помечено i18n-ignore ${report.ignored}, пропущено ${report.skipped.length}`);
  console.log(`  файлов ${report.files.size}, словарей ${report.dicts.size}${report.created.length ? `, создано модулей словаря: ${report.created.join(', ')}` : ''}`);
  for (const s of report.skipped) console.log(`  – ${s}`);
  const changed = opt('changed-list');
  if (changed) writeFileSync(changed, [...report.files].join('\n') + '\n');
}

if (cmd === 'scan') scanCommand();
else if (cmd === 'apply') applyCommand();
else {
  console.error('использование: i18n-extract.mjs scan <пути…> --out work.json | apply work.json names.json [--changed-list out.txt]');
  process.exit(2);
}
