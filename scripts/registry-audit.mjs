#!/usr/bin/env node
// Карта покрытия: что в реестре тестов есть, а чего нет.
//
// Отвечает на два вопроса:
//   1. по каждой зарегистрированной фиче — сколько случаев на каком уровне
//      и в каком статусе (в том числе сколько ждёт твоего решения);
//   2. какие области значимого кода вообще не заведены в реестр — это и есть
//      «чего у нас нет», вычисленное, а не составленное руками.
//
// Ничего не роняет: это отчёт, а не гейт. Гейт — check-registry.mjs.

import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { loadRegistry, featuresForPath, SIGNIFICANT_ROOTS, LEVELS, KINDS } from './lib/registry.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_EXT = /\.(ts|vue|cpp|hpp)$/;
const SKIP_DIR = /(^|\/)(node_modules|dist|\.git|\.quasar|build)(\/|$)/;

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(REPO_ROOT, full);
    if (SKIP_DIR.test(rel)) continue;
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, acc);
    else if (SOURCE_EXT.test(name)) acc.push(rel);
  }
  return acc;
}

/** Область = корень + следующий сегмент пути: extensions/capital, cpp/wallet и т.п. */
function areaOf(path) {
  for (const root of SIGNIFICANT_ROOTS) {
    if (path.startsWith(root)) {
      const rest = path.slice(root.length).split('/')[0];
      return root + rest;
    }
  }
  return null;
}

const { features, errors } = loadRegistry(REPO_ROOT);

if (errors.length) {
  console.log('Реестр не проходит валидацию:');
  for (const e of errors) console.log('  ✗ ' + e);
  console.log('');
}

console.log('РЕЕСТР ТЕСТОВ\n');

if (features.length === 0) {
  console.log('  (пуст — ни одной фичи не заведено)\n');
} else {
  for (const f of features) {
    const byStatus = { missing: 0, written: 0, passing: 0 };
    const byLevel = Object.fromEntries(LEVELS.map((l) => [l, 0]));
    const byKind = Object.fromEntries(KINDS.map((k) => [k, 0]));
    let decisions = 0;
    for (const c of f.cases) {
      byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
      byLevel[c.level] = (byLevel[c.level] ?? 0) + 1;
      byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;
      if (c.decision_needed) decisions++;
    }
    console.log(`  ${f.feature}  — ${f.title}`);
    console.log(
      `    случаев ${f.cases.length}:  ` +
        `зелёных ${byStatus.passing}, написано ${byStatus.written}, нет ${byStatus.missing}` +
        (decisions ? `   ⚑ ждут решения: ${decisions}` : ''),
    );
    console.log(
      `    уровни: ` +
        LEVELS.map((l) => `${l} ${byLevel[l]}`).join(', ') +
        `   |   ветки: ` +
        KINDS.map((k) => `${k} ${byKind[k]}`).join(', '),
    );
  }
  console.log('');
}

// --- области кода вне реестра ---------------------------------------------
const areas = new Map();
for (const root of SIGNIFICANT_ROOTS) {
  for (const file of walk(join(REPO_ROOT, root))) {
    const area = areaOf(file);
    if (!area) continue;
    const rec = areas.get(area) ?? { files: 0, covered: 0 };
    rec.files++;
    if (featuresForPath(features, file).length > 0) rec.covered++;
    areas.set(area, rec);
  }
}

const uncovered = [...areas.entries()].filter(([, r]) => r.covered === 0).sort((a, b) => b[1].files - a[1].files);
const partial = [...areas.entries()].filter(([, r]) => r.covered > 0 && r.covered < r.files);

console.log('ОБЛАСТИ КОДА ВНЕ РЕЕСТРА\n');
if (uncovered.length === 0) {
  console.log('  (нет — все области заведены)\n');
} else {
  for (const [area, r] of uncovered) console.log(`  ${String(r.files).padStart(5)} файлов   ${area}`);
  console.log('');
}

if (partial.length) {
  console.log('ОБЛАСТИ ПОКРЫТЫ ЧАСТИЧНО\n');
  for (const [area, r] of partial) console.log(`  ${r.covered}/${r.files} файлов   ${area}`);
  console.log('');
}

const totalFiles = [...areas.values()].reduce((s, r) => s + r.files, 0);
const totalCovered = [...areas.values()].reduce((s, r) => s + r.covered, 0);
console.log(
  `ИТОГО: фич в реестре ${features.length}; ` +
    `значимых файлов ${totalFiles}, из них связано с фичами ${totalCovered}; ` +
    `областей без реестра ${uncovered.length} из ${areas.size}.`,
);
