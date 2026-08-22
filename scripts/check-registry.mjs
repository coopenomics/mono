#!/usr/bin/env node
// Гейт реестра тестов.
//
// Что проверяется жёстко (роняет вердикт):
//   1. Схема реестра валидна, и каждый заявленный путь к тесту существует.
//      Статус выше `missing` без живого файла теста — это ложь в отчётности.
//   2. Если изменённый файл принадлежит УЖЕ зарегистрированной фиче, то файл
//      этой фичи в реестре обязан быть изменён тем же диффом. Тронул код —
//      зафиксируй, что с проверками.
//
// Что показывается, но не роняет:
//   - изменённые значимые файлы, не связанные ни с одной фичей реестра.
//     Реестр наполняется постепенно; блокировать здесь означало бы либо
//     остановить работу, либо заставить заводить фичи формально, лишь бы
//     прошло. Объём этого долга видно в `pnpm registry:audit`.
//
// Важная оговорка о границах метода: реестр защищает от забывчивости, а не
// от халтуры. Тест, написанный «чтобы позеленело», пройдёт этот гейт. От
// этого защищает только мутационное тестирование (`pnpm mutate:changed`).

import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry, featuresForPath, isSignificant } from './lib/registry.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function sh(cmd) {
  try {
    return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

function resolveBase() {
  if (process.env.CHECK_BASE) return process.env.CHECK_BASE;
  for (const c of ['origin/dev', 'dev', 'origin/main', 'main']) {
    if (sh(`git rev-parse --verify --quiet ${c}`).trim()) return c;
  }
  return '';
}

const base = resolveBase();
const mergeBase = base ? sh(`git merge-base HEAD ${base}`).trim() : '';
const diffFrom = mergeBase || 'HEAD';

const changed = new Set(
  [
    ...sh(`git diff --name-only --diff-filter=ACMR ${diffFrom}`).split('\n'),
    ...sh('git ls-files --others --exclude-standard').split('\n'),
  ]
    .map((s) => s.trim())
    .filter(Boolean),
);

console.log(`  база сравнения: ${base || 'HEAD'}${mergeBase ? ` (${mergeBase.slice(0, 9)})` : ''}`);

const { features, errors } = loadRegistry(REPO_ROOT);
let failed = false;

if (errors.length) {
  console.log('  реестр не проходит валидацию:');
  for (const e of errors) console.log('    ✗ ' + e);
  failed = true;
}

const changedSignificant = [...changed].filter(isSignificant);
const staleFeatures = new Map(); // feature -> файлы, из-за которых требуется обновление
const orphans = [];

for (const file of changedSignificant) {
  const matched = featuresForPath(features, file);
  if (matched.length === 0) {
    orphans.push(file);
    continue;
  }
  for (const f of matched) {
    if (!changed.has(f.file)) {
      const list = staleFeatures.get(f.feature) ?? { file: f.file, causes: [] };
      list.causes.push(file);
      staleFeatures.set(f.feature, list);
    }
  }
}

if (staleFeatures.size) {
  console.log('  изменён код зарегистрированных фич, а реестр не обновлён:');
  for (const [feature, { file, causes }] of staleFeatures) {
    console.log(`    ✗ ${feature} — обнови ${file}`);
    for (const c of causes.slice(0, 5)) console.log(`        из-за ${c}`);
    if (causes.length > 5) console.log(`        … и ещё ${causes.length - 5}`);
  }
  failed = true;
}

if (orphans.length) {
  console.log(`  вне реестра (долг, вердикт не роняют): ${orphans.length} изменённых значимых файлов`);
  for (const f of orphans.slice(0, 5)) console.log(`      ${f}`);
  if (orphans.length > 5) console.log(`      … и ещё ${orphans.length - 5}`);
}

if (!failed && !orphans.length && changedSignificant.length === 0) {
  console.log('  значимый код не тронут — проверять нечего');
}

process.exit(failed ? 1 : 0);
