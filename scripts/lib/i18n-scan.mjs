// Сканер пользовательского текста: находит кириллицу, написанную прямо в коде,
// а не в словаре.
//
// Общий для гейта `check-i18n.mjs` (считает долг) и инструмента переноса
// `i18n-extract.mjs` (заменяет найденное ключами), поэтому отдаёт не только
// строку и номер, но и точные смещения в файле.
//
// Что считается:
//   .vue, шаблон pug или HTML — текст между тегами, значения статических
//        атрибутов (label, title, placeholder…), строки внутри связанных
//        выражений (:label="ok ? 'Да' : 'Нет'") и внутри {{ … }};
//   .ts/.js и <script> в .vue — строковые и шаблонные литералы по AST.
//
// Что не считается — это не интерфейс:
//   комментарии и регулярные выражения (не литералы по AST);
//   аргументы console.* и logger.* — журнал для разработчика;
//   description/deprecationReason/summary внутри декораторов и
//   registerEnumType — документация GraphQL-схемы, она остаётся по-русски;
//   строковые типы (`type X = 'а'`), пути импорта, gql-шаблоны;
//   строка с пометкой `i18n-ignore` на той же или предыдущей строке
//   (`// i18n-ignore: причина`, в pug — `//- i18n-ignore: причина`).

import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(join(REPO_ROOT, 'package.json'));
const ts = require('typescript');
const { parse: parseSfc } = require('@vue/compiler-sfc');
const pugLex = require('pug-lexer');

export const CYRILLIC = /[А-Яа-яЁё]/;
export const IGNORE_MARK = 'i18n-ignore';

const LOG_METHODS = new Set(['log', 'info', 'warn', 'error', 'debug', 'verbose', 'trace', 'fatal', 'table', 'dir']);
const LOG_OBJECT = /(^|\.)(console|logger|_logger|log|Logger|pino)$/;
const DOC_PROPS = new Set(['description', 'deprecationReason', 'summary']);
const DOC_CALLS = new Set(['registerEnumType', 'createUnionType']);

// ─── позиции ────────────────────────────────────────────────────────────────

function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

function lineOf(starts, offset) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

// ─── скрипты ────────────────────────────────────────────────────────────────

function calleeName(expr) {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  return undefined;
}

function exclusionReason(node) {
  let child = node;
  let parent = node.parent;
  let docProp = false;
  while (parent) {
    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isImportTypeNode?.(parent)) return 'import';
    if (ts.isExternalModuleReference?.(parent)) return 'import';
    if (ts.isLiteralTypeNode(parent)) return 'type';
    if (ts.isPropertyAssignment(parent) && parent.initializer === child) {
      const name = parent.name && (ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name)) ? parent.name.text : '';
      if (DOC_PROPS.has(name)) docProp = true;
    }
    if (ts.isDecorator(parent) && docProp) return 'doc';
    if (ts.isTaggedTemplateExpression(parent)) {
      const tag = parent.tag.getText();
      if (/^(gql|graphql)$/.test(tag)) return 'gql';
    }
    if (ts.isCallExpression(parent) && parent.expression !== child) {
      const callee = parent.expression;
      if (ts.isPropertyAccessExpression(callee) && LOG_METHODS.has(callee.name.text)) {
        const obj = callee.expression.getText().replace(/\s+/g, '');
        if (LOG_OBJECT.test(obj)) return 'log';
      }
      const name = calleeName(callee);
      if (name && DOC_CALLS.has(name) && docProp) return 'doc';
    }
    // Логи вида this.logger.log({ message: 'рус' }) — объект внутри вызова лога.
    child = parent;
    parent = parent.parent;
  }
  return undefined;
}

const COMPARE_OPS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

/**
 * Подробности литерала для инструмента переноса: кавычка, части шаблонного
 * литерала (текст и выражения), контекст, в котором механическая замена
 * вызовом t() меняет смысл (сравнение, case, ключ объекта, член enum),
 * и исключение, аргументом которого литерал служит.
 */
function literalDetails(node, sf, base) {
  const d = {};
  const src = sf.text;
  d.quote = ts.isStringLiteral(node) ? src[node.getStart(sf)] : '`';
  if (ts.isTemplateExpression(node)) {
    d.parts = [{ text: node.head.text }];
    for (const span of node.templateSpans) {
      d.parts.push({ expr: span.expression.getText(sf) });
      d.parts.push({ text: span.literal.text });
    }
  }
  const parent = node.parent;
  if (parent) {
    if (ts.isBinaryExpression(parent) && COMPARE_OPS.has(parent.operatorToken.kind)) d.context = 'compare';
    else if (ts.isCaseClause(parent)) d.context = 'case';
    else if (ts.isEnumMember(parent)) d.context = 'enum';
    else if ((ts.isPropertyAssignment(parent) || ts.isPropertySignature?.(parent) || ts.isMethodDeclaration(parent)) && parent.name === node) d.context = 'propName';
    else if (ts.isComputedPropertyName(parent)) d.context = 'propName';
    else if (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) d.context = 'index';
    else if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression) && ['includes', 'startsWith', 'endsWith', 'indexOf', 'match', 'test', 'replace', 'split'].includes(parent.expression.name.text)) d.context = 'stringOp';
    else if (ts.isNewExpression(parent) || ts.isCallExpression(parent)) {
      const callee = parent.expression;
      const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : undefined;
      const argIndex = (parent.arguments ?? []).indexOf(node);
      if (ts.isNewExpression(parent) && name) {
        d.newCallee = name;
        d.argIndex = argIndex;
        if (name === 'HttpApiError' && argIndex === 1) d.statusExpr = parent.arguments[0].getText(sf);
        d.newStart = base + parent.getStart(sf);
        d.newEnd = base + parent.getEnd();
        d.newArgs = parent.arguments.length;
      } else if (name) {
        d.callee = name;
        d.argIndex = argIndex;
      }
    }
  }
  return d;
}

function hasCyrillicTemplate(node) {
  if (ts.isNoSubstitutionTemplateLiteral(node)) return CYRILLIC.test(node.text);
  if (ts.isTemplateExpression(node)) {
    if (CYRILLIC.test(node.head.text)) return true;
    return node.templateSpans.some((s) => CYRILLIC.test(s.literal.text));
  }
  return false;
}

/**
 * Литералы с кириллицей в коде TS/JS. `base` — смещение фрагмента в файле
 * (для <script> внутри .vue), `origin` — пометка, откуда фрагмент.
 */
export function scanScript(code, { base = 0, origin = 'script', fileName = 'x.ts' } = {}) {
  const sf = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found = [];
  const visit = (node) => {
    let hit = false;
    if (ts.isStringLiteral(node) && CYRILLIC.test(node.text)) hit = true;
    else if ((ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) && hasCyrillicTemplate(node)) hit = true;

    if (hit) {
      const excluded = exclusionReason(node);
      const start = node.getStart(sf);
      found.push({
        kind: ts.isStringLiteral(node) ? 'script-string' : 'script-template',
        origin,
        start: base + start,
        end: base + node.getEnd(),
        text: ts.isTemplateExpression(node) ? node.getText(sf).slice(1, -1) : node.text,
        excluded,
        ...literalDetails(node, sf, base),
      });
      // Внутри шаблонного литерала могут быть вложенные строки — их не считаем
      // отдельно: шаблон переносится целиком одним сообщением.
      if (ts.isTemplateExpression(node)) return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

// ─── шаблоны ────────────────────────────────────────────────────────────────

const INTERP = /\{\{([\s\S]*?)\}\}/g;

function scanExpression(expr, base, origin) {
  // Выражение шаблона — не модуль: оборачиваем в скобки, чтобы объектный
  // литерал и последовательность разбирались как выражение.
  return scanScript(`(${expr}\n)`, { base: base - 1, origin }).map((f) => ({ ...f, kind: 'tpl-expr-string' }));
}

function scanTextWithInterpolation(text, base, origin) {
  const found = [];
  let staticText = '';
  let last = 0;
  for (const m of text.matchAll(INTERP)) {
    staticText += text.slice(last, m.index);
    found.push(...scanExpression(m[1], base + m.index + 2, origin));
    last = m.index + m[0].length;
  }
  staticText += text.slice(last);
  if (CYRILLIC.test(staticText)) {
    found.unshift({ kind: 'tpl-text', origin, start: base, end: base + text.length, text });
  }
  return found;
}

function isBoundAttr(name) {
  return name.startsWith(':') || name.startsWith('@') || name.startsWith('#') || name.startsWith('v-');
}

function scanPug(src, tpl) {
  // compiler-sfc отдаёт шаблон pug без общего отступа, а позиции нужны в
  // исходном файле: сдвиг каждой строки — разница длин исходной и снятой.
  const content = tpl.content;
  const base = tpl.loc.start.offset;
  const original = src.slice(tpl.loc.start.offset, tpl.loc.end.offset);
  const oLines = original.split('\n');
  const cLines = content.split('\n');
  const oStarts = lineStarts(original);
  const shiftOf = (li) => Math.max(0, (oLines[li]?.length ?? 0) - (cLines[li]?.length ?? 0));
  const at = (loc) => oStarts[loc.line - 1] + shiftOf(loc.line - 1) + loc.column - 1;
  let tokens;
  try {
    tokens = pugLex(content, {});
  } catch (e) {
    return { found: [], error: `pug: ${e.message.split('\n')[0]}` };
  }
  const found = [];
  for (const tok of tokens) {
    if (tok.type === 'text' && typeof tok.val === 'string' && tok.val) {
      const offset = at(tok.loc.start);
      // Токен текста начинается там, где начинается сам текст.
      const idx = original.indexOf(tok.val, offset);
      const start = idx >= 0 && idx - offset < 4 ? idx : offset;
      found.push(...scanTextWithInterpolation(tok.val, base + start, 'template'));
    } else if (tok.type === 'attribute' && typeof tok.val === 'string') {
      const raw = tok.val;
      if (!CYRILLIC.test(raw)) continue;
      const tokStart = at(tok.loc.start);
      const valIdx = original.indexOf(raw, tokStart);
      const valStart = base + (valIdx >= 0 ? valIdx : tokStart);
      const quoted = /^(['"`]).*\1$/s.test(raw);
      if (isBoundAttr(tok.name)) {
        const inner = quoted ? raw.slice(1, -1) : raw;
        found.push(...scanExpression(inner, valStart + (quoted ? 1 : 0), 'template'));
      } else {
        found.push({
          kind: 'tpl-attr',
          origin: 'template',
          attr: tok.name,
          start: base + tokStart,
          end: valStart + raw.length,
          valueStart: valStart,
          valueEnd: valStart + raw.length,
          text: quoted ? raw.slice(1, -1) : raw,
        });
      }
    } else if ((tok.type === 'code' || tok.type === 'interpolated-code') && typeof tok.val === 'string' && CYRILLIC.test(tok.val)) {
      const offset = at(tok.loc.start);
      const idx = original.indexOf(tok.val, offset);
      found.push(...scanExpression(tok.val, base + (idx >= 0 ? idx : offset), 'template'));
    }
  }
  return { found };
}

function scanHtmlTemplate(src, tpl) {
  const found = [];
  const walk = (node) => {
    if (node.type === 2 && CYRILLIC.test(node.content)) {
      found.push({ kind: 'tpl-text', origin: 'template', start: node.loc.start.offset, end: node.loc.end.offset, text: node.content });
    } else if (node.type === 5 && node.content?.content && CYRILLIC.test(node.content.content)) {
      found.push(...scanExpression(node.content.content, node.content.loc.start.offset, 'template'));
    } else if (node.type === 1) {
      for (const p of node.props) {
        if (p.type === 6 && p.value && CYRILLIC.test(p.value.content)) {
          found.push({
            kind: 'tpl-attr',
            origin: 'template',
            attr: p.name,
            start: p.loc.start.offset,
            end: p.loc.end.offset,
            valueStart: p.value.loc.start.offset,
            valueEnd: p.value.loc.end.offset,
            text: p.value.content,
          });
        } else if (p.type === 7 && p.exp?.content && CYRILLIC.test(p.exp.content)) {
          found.push(...scanExpression(p.exp.content, p.exp.loc.start.offset, 'template'));
        }
      }
    }
    for (const c of node.children ?? []) walk(c);
  };
  if (tpl.ast) walk(tpl.ast);
  return { found };
}

// ─── файл ───────────────────────────────────────────────────────────────────

// Шаблонные строки, признанные не текстом интерфейса, записаны списком —
// комментарий в pug посреди списка атрибутов сломал бы шаблон.
const ALLOWLIST_PATH = join(REPO_ROOT, 'scripts/lib/i18n-ignore.json');
let allowlist;
function allowlisted(filePath, f) {
  if (allowlist === undefined) {
    allowlist = existsSync(ALLOWLIST_PATH) ? JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')) : {};
  }
  const rel = relative(REPO_ROOT, filePath);
  const entries = allowlist[rel];
  if (!entries || f.origin !== 'template') return false;
  const norm = normalizeText(f.text);
  return entries.some((e) => e.text === norm);
}

/** Текст находки как в списке исключений: {{ … }} → {0}, пробелы схлопнуты. */
export function normalizeText(text) {
  let i = 0;
  return text.replace(/\{\{[\s\S]*?\}\}/g, () => `{${i++}}`).replace(/\s+/g, ' ').trim();
}

function markIgnored(src, found, filePath) {
  const starts = lineStarts(src);
  const lines = src.split('\n');
  for (const f of found) {
    f.line = lineOf(starts, f.start);
    if (f.excluded) continue;
    if (filePath && allowlisted(filePath, f)) {
      f.excluded = 'allowlist';
      continue;
    }
    const same = lines[f.line - 1] ?? '';
    const prev = lines[f.line - 2] ?? '';
    if (same.includes(IGNORE_MARK) || /^\s*(\/\/|\/\/-|<!--|\*|\/\*)/.test(prev) && prev.includes(IGNORE_MARK)) {
      f.excluded = 'ignore';
    }
  }
  return found;
}

/**
 * Находки в файле. Каждая: { kind, origin, start, end, line, text, excluded? }.
 * `excluded` — причина, по которой находка не считается долгом.
 */
export function scanSource(src, filePath) {
  if (!CYRILLIC.test(src)) return { found: [] };
  if (filePath.endsWith('.vue')) {
    let descriptor;
    try {
      ({ descriptor } = parseSfc(src, { filename: filePath, ignoreEmpty: false }));
    } catch (e) {
      return { found: [], error: `sfc: ${e.message}` };
    }
    const found = [];
    let error;
    const tpl = descriptor.template;
    if (tpl) {
      const res = tpl.lang === 'pug' ? scanPug(src, tpl) : scanHtmlTemplate(src, tpl);
      found.push(...res.found);
      error = res.error;
    }
    for (const block of [descriptor.script, descriptor.scriptSetup]) {
      if (block && CYRILLIC.test(block.content)) {
        found.push(...scanScript(block.content, { base: block.loc.start.offset, origin: 'script' }));
      }
    }
    found.sort((a, b) => a.start - b.start);
    return { found: markIgnored(src, found, filePath), error };
  }
  return { found: markIgnored(src, scanScript(src, { fileName: filePath }), filePath) };
}

export function scanFile(absPath) {
  return scanSource(readFileSync(absPath, 'utf8'), absPath);
}
