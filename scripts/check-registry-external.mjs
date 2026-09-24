#!/usr/bin/env node
// Гейт внешнего слоя реестра тестов (C28-80).
//
// Зачем. Backend-случаи реестра почти целиком закрыты юнит-тестами контроллера,
// которые поднимают модуль Nest с подменёнными репозиториями. Такие тесты
// привязаны к TypeORM и к самому контроллеру: при уходе на Kysely они ломаются,
// при смене языка сервера — пропадают. Поведение, которое они описывают,
// должно быть подтверждено ещё и снаружи — тестом через API поднятого стенда
// (components/boot/src/tests), который переживёт и то и другое.
//
// Юнит-тесты остаются: они быстро проверяют правила изнутри. Внешний тест
// добавляется к случаю полем `api` (или сам `test` лежит во внешнем слое).
//
// Храповик. Долг — backend-случаи с тестом, но без внешнего теста — снят по
// фичам в scripts/lib/registry-external-baseline.json. Вердикт роняет только
// рост: новый backend-случай, закрытый одним юнит-тестом, или долг у новой
// фичи. Закрыл случай снаружи — долг снизился, обнови снимок:
//   node scripts/check-registry-external.mjs --update
// Снимок не обновится, если долг где-то вырос.
//
// Запуск: node scripts/check-registry-external.mjs   (входит в `pnpm check`)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry, hasExternalTest } from './lib/registry.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(REPO_ROOT, 'scripts/lib/registry-external-baseline.json');

const { features, errors } = loadRegistry(REPO_ROOT);
if (errors.length) {
  // Схему реестра проверяет гейт «реестр тестов»; здесь без валидного реестра считать нечего.
  console.log(`  реестр не проходит валидацию (${errors.length} ошибок) — см. гейт «реестр тестов»`);
  process.exit(1);
}

const debt = {};
const debtCases = {};
let external = 0;
let backendCovered = 0;
for (const f of features) {
  for (const c of f.cases) {
    if (c.level !== 'backend' || c.status === 'missing') continue;
    backendCovered++;
    if (hasExternalTest(c)) {
      external++;
      continue;
    }
    debt[f.feature] = (debt[f.feature] || 0) + 1;
    (debtCases[f.feature] ??= []).push(c.id);
  }
}

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
const grown = Object.entries(debt)
  .filter(([feature, count]) => count > (baseline[feature] ?? 0))
  .map(([feature, count]) => ({ feature, count, was: baseline[feature] ?? 0 }));

const total = Object.values(debt).reduce((a, b) => a + b, 0);
const baseTotal = Object.values(baseline).reduce((a, b) => a + b, 0);

function reportGrowth() {
  console.log('  backend-случай закрыт только юнит-тестом — добавьте внешний тест через API (поле api):');
  for (const g of grown) {
    console.log(`    ✗ ${g.feature}: было ${g.was}, стало ${g.count}`);
    const ids = debtCases[g.feature];
    console.log(`        случаи без внешнего теста: ${ids.slice(0, 8).join(', ')}${ids.length > 8 ? ` … и ещё ${ids.length - 8}` : ''}`);
  }
}

if (process.argv.includes('--update')) {
  // Первый снимок фиксирует долг как есть; дальше — только вниз.
  if (grown.length && existsSync(BASELINE)) {
    reportGrowth();
    console.log('  снимок не обновлён: долг вырос');
    process.exit(1);
  }
  const sorted = Object.fromEntries(Object.entries(debt).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(BASELINE, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`снимок долга записан: ${total} backend-случаев без внешнего теста в ${Object.keys(sorted).length} фичах`);
  process.exit(0);
}

if (grown.length) {
  reportGrowth();
  process.exit(1);
}

console.log(`  внешний слой: ${external} из ${backendCovered} покрытых backend-случаев; долг ${total} (в снимке ${baseTotal}), роста нет`);
if (total < baseTotal) {
  console.log('  долг снизился — обновите снимок: node scripts/check-registry-external.mjs --update');
}
