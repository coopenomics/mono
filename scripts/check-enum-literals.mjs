#!/usr/bin/env node
// Гейт «строка вместо перечисления».
//
// Значение из фиксированного набора (состояние заказа, вид, роль, код) код
// сравнивает с константой перечисления, а не со строкой:
//
//   if (order.status === MarketplaceOrderStatuses.ACCEPTED_TO_COOP)   // так
//   if (order.status === 'ACCEPTED_TO_COOP')                          // долг
//
// Строку в сравнении не найти поиском по перечислению: переименовали
// значение — сравнение молча перестало срабатывать, и компилятор этого не
// заметил (правило CLAUDE.md «Enum вместо строковых литералов», замечание
// владельца 20.11.2026). Гейт ловит сравнения `===`/`!==` и метки `case`
// со строкой ПРОПИСНЫМИ_БУКВАМИ — так в проекте записаны значения перечислений.
//
// Законное сравнение со строкой (внешний протокол без перечисления в коде)
// помечается рядом: // enum-literal: причина
//
// Использование:
//   node scripts/check-enum-literals.mjs            проверка
//   node scripts/check-enum-literals.mjs --update   переснять снимок (только вниз)

import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { REPO_ROOT, annotationNear, listFiles, splitLines, verdict } from './lib/fact-gates.mjs';

const ROOTS = [
  'components/controller/src',
  'components/extension-kit/src',
  'components/desktop/src',
  'components/desktop/extensions',
];
const EXCLUDE = [/\.spec\.ts$/, /\.test\.ts$/, /\/tests?\//, /\/_dev\//, /\/zeus\//, /keys\.generated\.ts$/, /\/migrations\//];

// Строка прописными буквами из трёх и более знаков: значение перечисления.
const VALUE = String.raw`'[A-Z][A-Z0-9_]{2,}'`;
const COMPARE = new RegExp(String.raw`(===|!==)\s*${VALUE}|${VALUE}\s*(===|!==)|\bcase\s+${VALUE}\s*:`);

const found = {};
for (const file of listFiles(ROOTS, { exts: ['.ts', '.vue'], exclude: EXCLUDE })) {
  const lines = splitLines(readFileSync(join(REPO_ROOT, file), 'utf8'));
  const hits = [];
  lines.forEach((l, i) => {
    if (!COMPARE.test(l.code)) return;
    if (annotationNear(lines, i, 'enum-literal') !== null) return;
    hits.push({ line: i + 1, text: l.raw });
  });
  found[file] = hits;
}

console.log('гейт «строка вместо перечисления»');
const code = verdict({
  title: 'строка вместо перечисления',
  baselinePath: join(REPO_ROOT, 'scripts/lib/enum-literals-baseline.json'),
  found,
  note:
    'Сравнения со строкой ПРОПИСНЫМИ вместо константы перечисления по файлам (scripts/check-enum-literals.mjs). Тронул файл — переведи на перечисление; долг только снижается.',
  hint:
    'Сравнивайте с константой перечисления (MarketplaceOrderStatuses.ACCEPTED_TO_COOP, Zeus.<Enum>.<VALUE>). ' +
    'Законную строку внешнего протокола пометьте: // enum-literal: причина.',
});
process.exit(code);
