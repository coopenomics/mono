#!/usr/bin/env node
// Гейт «TypeORM только вниз» (C28-81).
//
// Доступ к базе переводится с TypeORM на Kysely по доменам: схема и запросы —
// на SQL, типы таблиц — из миграций (`pnpm schema:types`). Пока перевод идёт,
// TypeORM живёт рядом, и гейт держит его долг: новый код пишется на Kysely,
// переведённый домен убирает долг насовсем.
//
// Виды долга:
//   imports  — файл импортирует `typeorm` или `@nestjs/typeorm`;
//   entities — класс-сущность `@Entity(...)`;
//   injects  — внедрение репозитория `@InjectRepository(...)`;
//   builders — построитель запросов `createQueryBuilder(...)`;
//   leaks    — импорт TypeORM за пределами слоя infrastructure (application,
//              domain): хранилище должно стоять за портом.
//
// Долг считается по файлам. Вердикт роняет рост: в файле стало больше мест,
// чем в снимке, или появился новый файл с TypeORM. Перевёл домен — долг
// снизился, переснять снимок:
//   node scripts/check-typeorm-ratchet.mjs --update
// Снимок не обновится, если долг где-то вырос.
//
// Запуск: node scripts/check-typeorm-ratchet.mjs   (входит в `pnpm check`)

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(REPO_ROOT, 'scripts/lib/typeorm-baseline.json');

const ROOTS = ['components/controller/src', 'components/extension-kit/src'];
const source = (rel) => rel.endsWith('.ts') && !rel.endsWith('.spec.ts') && !rel.endsWith('.d.ts');
const IMPORT = /from '(?:typeorm|@nestjs\/typeorm)(?:\/[^']*)?'/g;

const KINDS = {
  imports: { title: 'импорты TypeORM', roots: ROOTS, file: source, pattern: IMPORT },
  entities: { title: 'сущности @Entity', roots: ROOTS, file: source, pattern: /^@Entity\s*\(/gm },
  injects: { title: 'внедрения репозиториев', roots: ROOTS, file: source, pattern: /@InjectRepository\s*\(/g },
  builders: { title: 'построители запросов', roots: ROOTS, file: source, pattern: /\bcreateQueryBuilder\s*\(/g },
  leaks: {
    title: 'TypeORM вне слоя infrastructure',
    roots: ['components/controller/src'],
    file: (rel) => source(rel) && /\/(application|domain)\//.test(rel) && !rel.includes('/infrastructure/'),
    pattern: IMPORT,
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
  console.log('  TypeORM добавлен — новый код пишется на Kysely (C28-81):');
  for (const g of grown) console.log(`    ✗ ${g.file} — ${KINDS[g.kind].title}: было ${g.was}, стало ${g.count}`);
  process.exit(1);
}
if (lowered && !process.argv.includes('--update')) {
  console.log('  долг снизился — обновите снимок: node scripts/check-typeorm-ratchet.mjs --update');
}
