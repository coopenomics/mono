#!/usr/bin/env node
/**
 * Реальные циклы импортов контроллера и обёртки `forwardRef`, которые их
 * обходят.
 *
 * `forwardRef` нужен ровно там, где два файла ссылаются друг на друга во время
 * выполнения: один из них на момент вычисления второго ещё не готов. Обёртка,
 * поставленная «чтобы заработало», выглядит так же, как необходимая, и
 * отличить их чтением нельзя — отсюда счёт в восемь десятков.
 *
 * Скрипт считает граф по значимым импортам: `import type` компилятор стирает,
 * и цикла он не создаёт. Для каждой обёртки проверяется, существует ли обратный
 * путь от цели к владельцу без прямого ребра. Нет пути — обёртка лишняя.
 *
 * Запуск: node scripts/analyze-cycles.mjs [--json]
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(REPO_ROOT, 'components/controller/src');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.ts') && !/\.(spec|test|d)\.ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Путь модуля → файл. Алиас `~` указывает на `src` контроллера. */
function resolveSpecifier(spec, fromFile) {
  let base;
  if (spec.startsWith('~/')) base = join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return null;

  for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const files = walk(SRC);

/** file → Set<file>, только значимые (не стираемые) импорты. */
const graph = new Map();
/** Владелец обёртки → цели forwardRef, объявленные в нём. */
const forwardRefs = [];

const IMPORT_RE = /import\s+(type\s+)?([^;]*?)\s+from\s*['"]([^'"]+)['"]/g;

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const edges = new Set();

  IMPORT_RE.lastIndex = 0;
  let match;
  while ((match = IMPORT_RE.exec(source)) !== null) {
    const [, typeOnly, clause, spec] = match;
    const target = resolveSpecifier(spec, file);
    if (!target) continue;

    // `import type {...}` целиком стирается. У смешанного импорта значимой
    // остаётся часть без `type`, поэтому такой считаем значимым.
    const erased = Boolean(typeOnly) || /^\{\s*(type\s+[\w,\s]+)\s*\}$/.test(clause.trim());
    if (!erased) edges.add(target);
  }
  graph.set(file, edges);

  for (const fr of source.matchAll(/forwardRef\(\s*\(\)\s*=>\s*(\w+)\s*\)/g)) {
    forwardRefs.push({ file, symbol: fr[1] });
  }
}

/** Куда ведёт символ: ищем его импорт в файле-владельце. */
function targetOf(file, symbol) {
  const source = readFileSync(file, 'utf8');
  for (const m of source.matchAll(/import\s+(?:type\s+)?([^;]*?)\s+from\s*['"]([^'"]+)['"]/g)) {
    const names = m[1].replace(/[{}]/g, '').split(',').map((n) => n.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop().trim());
    if (names.includes(symbol)) return resolveSpecifier(m[2], file);
  }
  return null;
}

/** Есть ли путь from → to, игнорируя прямое ребро from → to. */
function hasPath(from, to, ignoreDirect) {
  const seen = new Set([from]);
  const stack = [from];
  while (stack.length) {
    const node = stack.pop();
    for (const next of graph.get(node) ?? []) {
      if (ignoreDirect && node === from && next === to) continue;
      if (next === to) return true;
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return false;
}

const rel = (f) => relative(join(REPO_ROOT, 'components/controller'), f);

const needed = [];
const redundant = [];
const unresolved = [];

for (const { file, symbol } of forwardRefs) {
  const target = targetOf(file, symbol);
  if (!target) {
    unresolved.push({ file: rel(file), symbol });
    continue;
  }
  // Цикл существует, если от цели есть путь обратно к владельцу.
  const record = { file: rel(file), symbol, target: rel(target) };
  if (hasPath(target, file, false)) needed.push(record);
  else redundant.push(record);
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ needed, redundant, unresolved }, null, 2));
} else {
  console.log(`Всего обёрток forwardRef: ${forwardRefs.length}`);
  console.log(`  обходят реальный цикл: ${needed.length}`);
  console.log(`  цикла нет — лишние:    ${redundant.length}`);
  console.log(`  цель не разрешилась:   ${unresolved.length}`);
  if (redundant.length) {
    console.log('\nЛишние:');
    for (const r of redundant) console.log(`  ${r.file}  →  ${r.symbol} (${r.target})`);
  }
  if (unresolved.length) {
    console.log('\nНе разрешились (символ объявлен в том же файле или приходит из пакета):');
    for (const u of unresolved) console.log(`  ${u.file}  →  ${u.symbol}`);
  }
}
