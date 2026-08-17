#!/usr/bin/env node
/**
 * Каталог портов `@coopenomics/innercoop` — кто владелец, кто потребитель, что
 * в контракте (DEC-019).
 *
 * Каталог собирается из кода, а не пишется руками: список из полусотни портов,
 * который ведут вручную, расходится с действительностью через месяц, и тогда
 * разработчик расширения снова идёт читать ядро — то самое, ради ухода от чего
 * порты и заводились.
 *
 * Источники: сами файлы портов (контракт и токен), биндинги моста (владелец
 * реализации), capability-заявки расширений (потребители).
 *
 * Запуск:
 *   node scripts/generate-ports-catalog.mjs            записать components/innercoop/PORTS.md
 *   node scripts/generate-ports-catalog.mjs --check    проверить, что файл актуален
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORTS_SRC = join(REPO_ROOT, 'components/innercoop/src');
const EXTENSIONS = join(REPO_ROOT, 'components/controller/src/extensions');
const BRIDGE = join(EXTENSIONS, 'innercoop-bridge.module.ts');
const OUTPUT = join(REPO_ROOT, 'components/innercoop/PORTS.md');

const SECTIONS = [
  ['core-ports', 'Порты ядра', 'Реализует контроллер, потребляют расширения.'],
  ['cross-plugin-ports', 'Межрасширенческие порты', 'Реализует одно расширение, потребляют другие.'],
  ['hooks', 'Хуки', 'Реализует расширение, вызывает ядро: обратное направление.'],
];

/** Первый абзац JSDoc над объявлением — назначение порта человеческим языком. */
function purposeOf(source, declaration) {
  const at = source.indexOf(declaration);
  if (at < 0) return '';
  const before = source.slice(0, at);
  const doc = before.match(/\/\*\*([\s\S]*?)\*\/\s*$/);
  if (!doc) return '';
  const text = doc[1]
    .split('\n')
    .map((line) => line.replace(/^\s*\*ь?/, '').replace(/^\s*\*/, '').trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const firstSentence = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return firstSentence;
}

/**
 * Первая фраза шапки файла — когда ни у токена, ни у интерфейса JSDoc нет.
 * Шапка не обязательно в первой строке: у половины портов над ней стоят
 * импорты типов из соседнего контракта.
 */
function fileHeaderOf(source) {
  const header = source.match(/\/\*\*([\s\S]*?)\*\//);
  if (!header) return '';
  const text = header[1]
    .split('\n')
    .map((line) => line.replace(/^\s*\*/, '').trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.split(/(?<=[.!?])\s/)[0] ?? text;
}

/** Методы интерфейса — по одной строке на сигнатуру, без тел JSDoc. */
function methodsOf(source, interfaceName) {
  const start = source.indexOf(`export interface ${interfaceName} {`);
  if (start < 0) return [];
  let depth = 0;
  let end = start;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = source.slice(source.indexOf('{', start) + 1, end);
  const withoutComments = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  return [...withoutComments.matchAll(/^\s{2}(\w+)\s*[(<]/gm)].map((m) => m[1]);
}

const bridge = readFileSync(BRIDGE, 'utf8');

/** Кто реализует порт: адаптер из биндинга моста. */
function ownerOf(token) {
  const direct = bridge.match(
    new RegExp(`provide:\\s*${token}\\s*,\\s*use(?:Existing|Class)\\s*:\\s*(\\w+)`, 's')
  );
  if (direct) return direct[1];
  // Часть портов привязана перечислением класса-адаптера без явного provide.
  return null;
}

/** Кто потребляет порт: расширения, объявившие его в capability-заявке. */
const consumers = new Map();
for (const entry of readdirSync(EXTENSIONS, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  let declaration;
  try {
    declaration = readFileSync(join(EXTENSIONS, entry.name, `${entry.name}.ports.ts`), 'utf8');
  } catch {
    continue;
  }
  const optionalFrom = declaration.indexOf('optional: [');
  for (const match of declaration.matchAll(/^\s{4}(\w+_PORT),$/gm)) {
    const optional = match.index > optionalFrom && optionalFrom > 0;
    if (!consumers.has(match[1])) consumers.set(match[1], []);
    consumers.get(match[1]).push(optional ? `${entry.name}*` : entry.name);
  }
}

const lines = [
  '# Каталог портов `@coopenomics/innercoop`',
  '',
  'Расширение разговаривает с ядром и соседями только через порты: контракт',
  'плюс DI-токен, реализация подставляется мостом. Этот файл отвечает на',
  'вопрос «что мне доступно» — без него разработчик расширения идёт читать',
  'ядро, то есть ровно туда, откуда порты и уводят.',
  '',
  '**Файл собирается из кода**: `node scripts/generate-ports-catalog.mjs`.',
  'Править руками бессмысленно — правка потеряется при следующей сборке.',
  '',
  'Звёздочка у потребителя означает необязательный порт: расширение переживает',
  'его отсутствие, часть возможностей при этом выключена.',
  '',
];

let total = 0;
for (const [dir, title, hint] of SECTIONS) {
  let files;
  try {
    files = readdirSync(join(PORTS_SRC, dir)).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
  } catch {
    continue;
  }

  const rows = [];
  for (const file of files.sort()) {
    const source = readFileSync(join(PORTS_SRC, dir, file), 'utf8');
    for (const tokenMatch of source.matchAll(/export const (\w+) = Symbol\.for\('([^']+)'\)/g)) {
      const [, constName, symbolName] = tokenMatch;
      const iface =
        source.match(/export interface (I\w*Port)\s/)?.[1] ??
        source.match(/export interface (I\w+)\s/)?.[1] ??
        '';
      const methods = iface ? methodsOf(source, iface) : [];
      // Назначение ищем в трёх местах по убыванию точности: у самого токена, у
      // интерфейса порта, у файла целиком. Шапка файла есть почти всегда —
      // именно в ней объясняют, зачем порт заведён.
      const purpose =
        purposeOf(source, `export const ${constName}`) ||
        (iface && purposeOf(source, `export interface ${iface}`)) ||
        fileHeaderOf(source);
      rows.push({
        constName,
        symbolName,
        iface,
        file: `${dir}/${file}`,
        purpose,
        methods,
        owner: ownerOf(constName),
        used: (consumers.get(constName) ?? []).sort(),
      });
      total++;
    }
  }

  if (!rows.length) continue;

  lines.push(`## ${title}`, '', hint, '');
  lines.push('| Порт | Контракт | Реализует | Потребители | Назначение |');
  lines.push('|---|---|---|---|---|');
  for (const row of rows) {
    const methods = row.methods.length ? ` (${row.methods.length})` : '';
    lines.push(
      `| \`${row.constName}\` | \`${row.iface}\`${methods}<br><sub>${row.file}</sub> | ${
        row.owner ? `\`${row.owner}\`` : '—'
      } | ${row.used.length ? row.used.join(', ') : '—'} | ${row.purpose} |`
    );
  }
  lines.push('');
}

lines.push(`Всего портов: ${total}.`, '');

const content = lines.join('\n');

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(OUTPUT, 'utf8');
  } catch {
    current = '';
  }
  if (current !== content) {
    console.error('  каталог портов устарел — пересобрать: node scripts/generate-ports-catalog.mjs');
    process.exit(1);
  }
  console.log(`  каталог портов актуален (${total} портов)`);
  process.exit(0);
}

writeFileSync(OUTPUT, content);
console.log(`  каталог портов записан: ${OUTPUT} (${total} портов)`);
