#!/usr/bin/env node
// Гейт плательщика за оперативную память в контрактах.
//
// Зачем. Оперативную память цепи оплачивает аккаунт, чьё имя передано в
// `emplace` или `modify`, и плательщик меняется при каждом изменении строки.
// Пока имя передавалось в каждом месте вручную, одна и та же сущность
// оказывалась то на кооперативе, то на контракте, то на человеке (C28-78).
// Правило теперь живёт в одном месте — классе строки таблицы, а плательщика
// выдаёт `RamPayer::of` (components/contracts/cpp/lib/core/ram_payer.hpp).
// Гейт следит, чтобы в `emplace` и `modify` не передавали голое имя.
//
// Храповик. Мест, переведённых на хелпер, пока меньше, чем всех: долг
// зафиксирован по файлам в scripts/lib/ram-payer-baseline.json. Вердикт
// роняет только рост — новое место с голым именем или новый файл с таким
// местом. Переведённый файл снижает долг; обновить снимок —
// `node scripts/check-ram-payer.mjs --update`.
//
// Какие вызовы считаются записью в таблицу. У `multi_index` последний
// аргумент `emplace` и `modify` — лямбда, заполняющая строку. По этому
// признаку они отличаются от `emplace` стандартных контейнеров.
//
// Запуск: node scripts/check-ram-payer.mjs   (входит в `pnpm check`)

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACTS = join(REPO_ROOT, 'components/contracts/cpp');
const BASELINE = join(REPO_ROOT, 'scripts/lib/ram-payer-baseline.json');

// Системный контракт eosio и тесты живут по своим правилам.
const SKIP_DIRS = new Set(['system', 'tests', 'test', 'build']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (dir === CONTRACTS && SKIP_DIRS.has(entry)) continue;
      walk(full, out);
    } else if (/\.(hpp|cpp)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

// Аргументы вызова от открывающей скобки: делим по запятым верхнего уровня.
function splitArgs(src, openIdx) {
  const args = [];
  let depth = 0;
  let start = openIdx + 1;
  let inStr = null;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") { inStr = ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) {
        args.push(src.slice(start, i).trim());
        return args;
      }
    } else if (ch === ',' && depth === 1) {
      args.push(src.slice(start, i).trim());
      start = i + 1;
    }
  }
  return args;
}

function stripComments(src) {
  // Длина сохраняется, чтобы номера строк остались верными.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

function scan() {
  const violations = [];
  for (const file of walk(CONTRACTS)) {
    const src = stripComments(readFileSync(file, 'utf8'));
    const re = /\.(emplace|modify)\s*\(/g;
    let m;
    while ((m = re.exec(src))) {
      const kind = m[1];
      const args = splitArgs(src, m.index + m[0].length - 1);
      const expected = kind === 'emplace' ? 2 : 3;
      if (args.length !== expected || !args[expected - 1].startsWith('[')) continue;
      const payer = args[kind === 'emplace' ? 0 : 1];
      if (payer.startsWith('RamPayer::of(')) continue;
      const line = src.slice(0, m.index).split('\n').length;
      violations.push({ file: relative(REPO_ROOT, file), line, kind, payer });
    }
  }
  return violations;
}

const violations = scan();
const byFile = {};
for (const v of violations) byFile[v.file] = (byFile[v.file] || 0) + 1;

if (process.argv.includes('--update')) {
  const sorted = Object.fromEntries(Object.entries(byFile).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(BASELINE, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`снимок долга записан: ${violations.length} мест в ${Object.keys(sorted).length} файлах`);
  process.exit(0);
}

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
const grown = [];
for (const [file, count] of Object.entries(byFile)) {
  if (count > (baseline[file] ?? 0)) grown.push({ file, count, was: baseline[file] ?? 0 });
}

const total = violations.length;
const baseTotal = Object.values(baseline).reduce((a, b) => a + b, 0);

if (grown.length) {
  console.log('  плательщик передан голым именем — используйте RamPayer::of(table, coopname):');
  for (const g of grown) {
    console.log(`    ✗ ${g.file}: было ${g.was}, стало ${g.count}`);
    for (const v of violations.filter((x) => x.file === g.file)) {
      console.log(`        ${v.line}: ${v.kind}(${v.payer})`);
    }
  }
  process.exit(1);
}

console.log(`  долг перевода на RamPayer::of: ${total} мест (в снимке ${baseTotal}), роста нет`);
if (total < baseTotal) {
  console.log('  долг снизился — обновите снимок: node scripts/check-ram-payer.mjs --update');
}
