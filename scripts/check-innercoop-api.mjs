#!/usr/bin/env node
/**
 * Снимок публичного API `@coopenomics/innercoop` (INV-009).
 *
 * Пакет — контракт между ядром и расширениями, в том числе теми, которые уже
 * уехали в отдельные репозитории. Изменение контракта у них ничего не сломает
 * в момент правки: они соберутся позже, на другой версии, и разойдутся молча.
 * Поэтому изменение публичного API обязано быть видно в диффе — тогда автор
 * решает про версию осознанно, а не задним числом.
 *
 * Снимок структурный: имена экспортов и состав каждого интерфейса. Тела
 * комментариев и порядок в него не входят — переписанный JSDoc контракта не
 * меняет, а лишний шум в диффе делает гейт бесполезным.
 *
 * Запуск:
 *   node scripts/check-innercoop-api.mjs           записать components/innercoop/API.md
 *   node scripts/check-innercoop-api.mjs --check    проверить, что снимок актуален
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(REPO_ROOT, 'components/innercoop/src');
const OUTPUT = join(REPO_ROOT, 'components/innercoop/API.md');
const SECTIONS = ['core-ports', 'cross-plugin-ports', 'hooks'];

/** Убрать комментарии: они в контракт не входят. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Члены интерфейса — по одному на строку, схлопнутые пробелы. */
function membersOf(source, start) {
  const open = source.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  return source
    .slice(open + 1, end)
    .split(/;|\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

const entries = [];

for (const section of SECTIONS) {
  let files;
  try {
    files = readdirSync(join(SRC, section)).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
  } catch {
    continue;
  }

  for (const file of files.sort()) {
    const source = stripComments(readFileSync(join(SRC, section, file), 'utf8'));

    for (const match of source.matchAll(/export (interface|type|enum|const) (\w+)/g)) {
      const [, kind, name] = match;
      if (kind === 'interface' || kind === 'enum') {
        entries.push({ section, kind, name, members: membersOf(source, match.index) });
      } else if (kind === 'const') {
        const symbol = source.slice(match.index).match(/Symbol\.for\('([^']+)'\)/);
        entries.push({ section, kind, name, members: symbol ? [`Symbol.for('${symbol[1]}')`] : [] });
      } else {
        const body = source.slice(match.index).match(/=\s*([^;]+);/);
        entries.push({ section, kind, name, members: body ? [body[1].replace(/\s+/g, ' ').trim()] : [] });
      }
    }
  }
}

entries.sort((a, b) => a.name.localeCompare(b.name));

const lines = [
  '# Публичный API `@coopenomics/innercoop`',
  '',
  'Снимок контракта: имена экспортов и состав каждого из них. Расширение,',
  'уехавшее в свой репозиторий, собирается против этих объявлений, поэтому',
  'изменение здесь — событие версии, а не деталь правки.',
  '',
  '**Файл собирается из кода**: `node scripts/check-innercoop-api.mjs`.',
  'Изменился — проверьте, ломает ли это потребителей: удаление или переименование',
  'экспорта, исчезнувший метод, новый обязательный параметр требуют major, а',
  'снятое старое — периода устаревания не меньше одного minor (INV-009).',
  '',
  `Всего экспортов: ${entries.length}.`,
  '',
];

for (const entry of entries) {
  lines.push(`## ${entry.name}`);
  lines.push('');
  lines.push(`\`${entry.kind}\` · ${entry.section}`);
  lines.push('');
  for (const member of entry.members) lines.push(`- \`${member}\``);
  lines.push('');
}

const content = lines.join('\n');

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(OUTPUT, 'utf8');
  } catch {
    current = '';
  }
  if (current !== content) {
    console.error('  публичный API контракта изменился, снимок устарел.');
    console.error('  Пересобрать: node scripts/check-innercoop-api.mjs');
    console.error('  Дифф снимка покажет, ломает ли правка потребителей (INV-009).');
    process.exit(1);
  }
  console.log(`  снимок публичного API актуален (${entries.length} экспортов)`);
  process.exit(0);
}

writeFileSync(OUTPUT, content);
console.log(`  снимок публичного API записан: ${OUTPUT} (${entries.length} экспортов)`);
