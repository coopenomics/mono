#!/usr/bin/env node
// Гейт «шаблоны только на pug» (канон desktop).
//
// Шаблоны компонентов desktop пишутся на pug: `<template lang="pug">`. Долг —
// компоненты, чей шаблон написан на HTML; он зафиксирован по файлам в снимке
// scripts/lib/vue-pug-baseline.json. Вердикт роняет рост: новый компонент с
// HTML-шаблоном или старый, переведённый с pug обратно. Перевёл компонент на
// pug — долг снизился, переснять снимок:
//   node scripts/check-vue-pug.mjs --update
// Снимок не обновится, если долг где-то вырос.
//
// Компонент без шаблона (только render-функция) долгом не считается.
// Сайт стандартов (components/contracts/standards-site) в гейт не входит: pug
// там не подключён.
//
// Запуск: node scripts/check-vue-pug.mjs   (входит в `pnpm check`)

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(REPO_ROOT, 'scripts/lib/vue-pug-baseline.json');
const ROOTS = ['components/desktop/src', 'components/desktop/extensions'];
const SKIP = new Set(['node_modules', 'dist', '.quasar']);

/** Открывающие теги шаблона верхнего уровня: `<template ...>` в начале строки. */
const TEMPLATE_TAG = /^<template(\s[^>]*)?>/gm;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.vue')) out.push(full);
  }
  return out;
}

function htmlTemplate(source) {
  const tags = [...source.matchAll(TEMPLATE_TAG)];
  if (tags.length === 0) return false;
  return !tags.some((tag) => /\blang=["']pug["']/.test(tag[1] ?? ''));
}

function measure() {
  const files = [];
  for (const root of ROOTS) {
    for (const full of walk(join(REPO_ROOT, root))) {
      if (htmlTemplate(readFileSync(full, 'utf8'))) files.push(relative(REPO_ROOT, full));
    }
  }
  return files.sort();
}

const current = measure();
let baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : [];
let grown = current.filter((file) => !baseline.includes(file));

if (process.argv.includes('--update')) {
  // Первый снимок фиксирует долг как есть — сравнивать ещё не с чем.
  if (grown.length && existsSync(BASELINE)) {
    console.log('  снимок не обновлён: долг вырос');
    for (const file of grown) console.log(`    ✗ ${file}`);
    process.exit(1);
  }
  writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`  снимок записан: ${relative(REPO_ROOT, BASELINE)}`);
  baseline = current;
  grown = [];
}

console.log(`  шаблонов на HTML: ${current.length} (в снимке ${baseline.length})`);

if (grown.length) {
  console.log('  шаблон компонента пишется на pug — <template lang="pug">:');
  for (const file of grown) console.log(`    ✗ ${file}`);
  process.exit(1);
}
if (current.length < baseline.length && !process.argv.includes('--update')) {
  console.log('  долг снизился — обновите снимок: node scripts/check-vue-pug.mjs --update');
}
