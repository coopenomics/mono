#!/usr/bin/env node
// Гейт «права на ролях» (C28-87).
//
// Права на платформе переводятся на одну систему: приложение объявляет матрицу
// прав `Resource:action`, ядро собирает из неё Ability (CASL, auth-v2), из неё
// же — серверный гард и гранты стола для фронта. Пока перевод идёт, старые
// механизмы живут рядом, и гейт держит их долг: новых мест со старыми правами
// не появляется, а переведённые места убирают долг насовсем.
//
// Виды долга:
//   authroles     — `@AuthRoles(...)` в контроллере: право по роли пайщика, без
//                   договоров, допусков и онбординга приложения;
//   market-guards — собственные гарды Стола заказов (`@RequireMarketplaceAccess`,
//                   `@RequireMarketplaceRole`): своя таблица прав мимо CASL;
//   route-roles   — `roles: [...]` в объявлениях маршрутов desktop: экран решает
//                   по роли, вместо того чтобы сверить выданное сервером право
//                   (`meta.requires`).
//
// Долг считается по файлам. Вердикт роняет рост: в файле стало больше мест,
// чем в снимке, или появился новый файл со старыми правами. Перевёл места —
// долг снизился, переснять снимок:
//   node scripts/check-legacy-rights.mjs --update
// Снимок не обновится, если долг где-то вырос.
//
// Вторая часть гейта — охваты прав. Право с узким охватом (`own`, `own-KU`,
// `chaired-KU`, `to-self`) сверяет общая проверка каркаса расширений, поэтому:
//   - операция с таким правом называет источник объекта сверки третьим
//     аргументом `@RequireRight` (`SELF`, `{ ku }`, `{ of, id }`, `{ list }`);
//   - резолвер сам состав участка не читает: частная сверка в теле операции
//     расходится с таблицей прав и с рабочим столом.
// Долга здесь нет: нарушение роняет вердикт сразу.
//
// Запуск: node scripts/check-legacy-rights.mjs   (входит в `pnpm check`)

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(REPO_ROOT, 'scripts/lib/legacy-rights-baseline.json');

const KINDS = {
  authroles: {
    title: '@AuthRoles в контроллере',
    roots: ['components/controller/src'],
    file: (rel) => rel.endsWith('.ts') && !rel.endsWith('.spec.ts'),
    pattern: /@AuthRoles\s*\(/g,
  },
  'market-guards': {
    title: 'собственные гарды Стола заказов',
    roots: ['components/controller/src/extensions/marketplace'],
    file: (rel) => rel.endsWith('.ts') && !rel.endsWith('.spec.ts'),
    pattern: /@RequireMarketplace(?:Access|Role)\s*\(/g,
  },
  'route-roles': {
    title: 'roles в маршрутах desktop',
    roots: [
      'components/desktop/extensions',
      'components/desktop/src/app/providers/routes',
      'components/desktop/src/desktops',
    ],
    file: (rel) => rel.endsWith('.ts') && !rel.includes('/i18n/'),
    pattern: /\broles\s*:\s*\[/g,
  },
};

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function measure() {
  const debt = {};
  for (const [kind, spec] of Object.entries(KINDS)) {
    debt[kind] = {};
    for (const root of spec.roots) {
      for (const full of walk(join(REPO_ROOT, root))) {
        const rel = relative(REPO_ROOT, full);
        if (!spec.file(rel)) continue;
        const count = (readFileSync(full, 'utf8').match(spec.pattern) ?? []).length;
        if (count) debt[kind][rel] = count;
      }
    }
  }
  return debt;
}

const sum = (files) => Object.values(files).reduce((a, b) => a + b, 0);

const current = measure();
let baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};

const grown = [];
for (const [kind, files] of Object.entries(current)) {
  for (const [file, count] of Object.entries(files)) {
    const was = baseline[kind]?.[file] ?? 0;
    if (count > was) grown.push({ kind, file, count, was });
  }
}

if (process.argv.includes('--update')) {
  // Первый снимок фиксирует долг как есть — сравнивать ещё не с чем.
  if (grown.length && existsSync(BASELINE)) {
    console.log('  снимок не обновлён: долг вырос');
    for (const g of grown) console.log(`    ✗ ${g.file} — ${KINDS[g.kind].title}: было ${g.was}, стало ${g.count}`);
    process.exit(1);
  }
  writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`  снимок записан: ${relative(REPO_ROOT, BASELINE)}`);
  baseline = current;
  grown.length = 0;
}

let lowered = false;
for (const [kind, spec] of Object.entries(KINDS)) {
  const now = sum(current[kind]);
  const was = sum(baseline[kind] ?? {});
  if (now < was) lowered = true;
  console.log(`  ${spec.title}: ${now} мест в ${Object.keys(current[kind]).length} файлах (в снимке ${was})`);
}

if (grown.length) {
  console.log('  старые права добавлены — объявите право в матрице приложения (C28-87):');
  for (const g of grown) console.log(`    ✗ ${g.file} — ${KINDS[g.kind].title}: было ${g.was}, стало ${g.count}`);
  process.exit(1);
}
if (lowered && !process.argv.includes('--update')) {
  console.log('  долг снизился — обновите снимок: node scripts/check-legacy-rights.mjs --update');
}

// ─── охваты прав: источник объекта у операции, сверка — в общем гарде ────────

const NARROW_SCOPE = /:(own|own-KU|chaired-KU|to-self)$/;
// Ядро и расширения: общий гард один на всех.
const EXTENSIONS_ROOT = 'components/controller/src';
// Чтение состава участка, которое сверкой охвата не является.
const BRANCH_READ_ALLOWED = {
  'components/controller/src/extensions/marketplace/application/resolvers/marketplace-membership.resolver.ts':
    'marketplaceWhoAmI отдаёт пайщику список его участков как данные',
};
const BRANCH_CHECK = /\b(?:isMemberOfBranch|assertIsMemberOfBranch|listBranamesForMember|canActAsBraname|assertCanActAsBraname)\s*\(/g;

/** Права, у которых охват в имени не записан: `Ресурс:действие` из перечня приложения. */
function impliedScopes() {
  const out = new Set();
  for (const full of walk(join(REPO_ROOT, EXTENSIONS_ROOT))) {
    if (!full.endsWith('.ts')) continue;
    const block = /RightScopes\s*:\s*Record<string,[^>]*>\s*=\s*\{([^}]*)\}/.exec(readFileSync(full, 'utf8'));
    if (!block) continue;
    for (const m of block[1].matchAll(/'([A-Za-z]+:[^']+)'\s*:/g)) out.add(m[1]);
  }
  return out;
}

const implied = impliedScopes();
const scopeProblems = [];
let scoped = 0;
for (const full of walk(join(REPO_ROOT, EXTENSIONS_ROOT))) {
  const rel = relative(REPO_ROOT, full);
  if (!rel.endsWith('.resolver.ts')) continue;
  const src = readFileSync(full, 'utf8');
  const requirements = [...src.matchAll(/^[ \t]*@RequireRight\(\s*'([A-Za-z]+)'\s*,\s*(\[[^\]]*\]|'[^']*')\s*(,[^)]*)?\)/gm)];
  if (requirements.length === 0) continue;
  for (const m of requirements) {
    const actions = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    if (!actions.some((action) => NARROW_SCOPE.test(action) || implied.has(`${m[1]}:${action}`))) continue;
    scoped += 1;
    if (!m[3]) scopeProblems.push(`${rel} — ${m[1]}:${actions.join('|')}: источник объекта сверки не назван`);
  }
  const checks = (src.match(BRANCH_CHECK) ?? []).length;
  if (checks && !BRANCH_READ_ALLOWED[rel]) {
    scopeProblems.push(`${rel} — состав участка читается в резолвере (${checks}): сверку охвата ведёт общий гард`);
  }
}
console.log(`  охваты прав: ${scoped} требований с узким охватом, источник назван у ${scoped - scopeProblems.filter((p) => p.includes('источник')).length}`);
if (scopeProblems.length) {
  console.log('  охват права сверяет общий гард — назовите источник в @RequireRight и уберите сверку из резолвера (C28-87):');
  for (const problem of scopeProblems) console.log(`    ✗ ${problem}`);
  process.exit(1);
}
