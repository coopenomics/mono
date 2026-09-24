#!/usr/bin/env node
/**
 * Гейт «схема базы — только миграциями» (C28-79).
 *
 * 1. Нигде в контроллере и каркасе расширений нет `synchronize: true`.
 *    Он молча удалял колонки, которых нет в сущности, превращал переименование
 *    в потерю данных и в blue-green выкатке правил общую базу, пока старая
 *    версия ещё работала. Схему меняют миграции (`pnpm schema:generate`).
 * 2. Расширение, у которого есть таблицы (`<имя>.entities.ts`), объявляет и их
 *    миграции (`<имя>.database-migrations.ts`) — иначе на новом узле его
 *    таблицы не появятся.
 * 3. Ветка, изменившая схему сущности (декоратор или опцию колонки), приносит
 *    и миграцию того же владельца — по диффу от общей с dev точки.
 *
 * Что сущности совпадают с миграциями, проверяет `pnpm schema:check` в CI —
 * ему нужна живая база.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const scanRoots = ['components/controller/src', 'components/controller/scripts', 'components/extension-kit/src'];
const problems = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') walk(full);
    } else if (/\.ts$/.test(entry.name) && !/\.(spec|test)\.ts$/.test(entry.name)) {
      const lines = fs.readFileSync(full, 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        if (/\bsynchronize\s*:\s*true\b/.test(line)) {
          problems.push(`${path.relative(root, full)}:${index + 1} — synchronize: true; схему меняют миграции (pnpm schema:generate)`);
        }
      });
    }
  }
}

for (const dir of scanRoots) walk(path.join(root, dir));

const extensionsDir = path.join(root, 'components/controller/src/extensions');
for (const name of fs.readdirSync(extensionsDir).sort()) {
  const entities = path.join(extensionsDir, name, `${name}.entities.ts`);
  const migrations = path.join(extensionsDir, name, `${name}.database-migrations.ts`);
  if (fs.existsSync(entities) && !fs.existsSync(migrations)) {
    problems.push(`расширение ${name}: есть ${name}.entities.ts, но нет ${name}.database-migrations.ts — таблицы не появятся на новом узле`);
  }
}

// 3. Правка схемы в сущности приходит вместе с миграцией её владельца.
//    Ветка, изменившая декоратор или опцию колонки, без новой миграции того же
//    владельца уезжает на узел с кодом, которого база не знает: колонки нет,
//    запрос падает. `schema:check` в CI это тоже поймает, но только на Postgres
//    и после пуша; здесь — сразу, по диффу от общей с dev точки.
//    Правка без влияния на таблицу (комментарий, порядок) помечается в самой
//    правке: `// schema-unchanged: причина`.
function sh(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return '';
  }
}

function resolveBase() {
  if (process.env.CHECK_BASE) return process.env.CHECK_BASE;
  for (const candidate of ['origin/dev', 'dev']) {
    if (sh(`git rev-parse --verify --quiet ${candidate}`).trim()) return candidate;
  }
  return '';
}

const SCHEMA_LINE =
  /@(Entity|ViewEntity|Column|PrimaryColumn|PrimaryGeneratedColumn|CreateDateColumn|UpdateDateColumn|DeleteDateColumn|VersionColumn|Index|Unique|Check|ManyToOne|OneToOne|OneToMany|ManyToMany|JoinColumn|JoinTable|TableInheritance|ChildEntity)\b|^\s*(type|nullable|default|length|precision|scale|unique|enum|enumName|array|primary|onDelete|onUpdate|name)\s*:/;

/** Владелец таблиц файла: расширение со своей декларацией сущностей либо ядро. */
function schemaOwner(file) {
  const match = file.match(/^components\/controller\/src\/extensions\/([^/]+)\//);
  if (match && fs.existsSync(path.join(extensionsDir, match[1], `${match[1]}.entities.ts`))) return match[1];
  return 'core';
}

function ownerMigrationsDir(owner) {
  return owner === 'core'
    ? 'components/controller/src/infrastructure/database/migrations/'
    : `components/controller/src/extensions/${owner}/migrations/database/`;
}

const base = resolveBase();
/**
 * Общая с dev точка. Посреди незакоммиченного слияния dev (`MERGE_HEAD`) общей
 * точкой считается уже вливаемый dev — иначе его собственные миграции выглядели
 * бы правкой ветки.
 */
function diffBase() {
  if (!base) return '';
  const points = [sh(`git merge-base HEAD ${base}`).trim()];
  if (sh('git rev-parse --verify --quiet MERGE_HEAD').trim()) points.push(sh(`git merge-base MERGE_HEAD ${base}`).trim());
  return points.filter(Boolean).reduce((later, point) =>
    later && sh(`git merge-base --is-ancestor ${point} ${later} && echo yes`).trim() ? later : point, '');
}

const mergeBase = diffBase();
if (mergeBase) {
  const changed = [
    ...sh(`git diff --name-only --diff-filter=ACMRD ${mergeBase}`).split('\n'),
    ...sh('git ls-files --others --exclude-standard').split('\n'),
  ]
    .map((line) => line.trim())
    .filter(Boolean);
  const inScope = (file) =>
    /\.ts$/.test(file) &&
    !/\.(spec|test)\.ts$/.test(file) &&
    (file.startsWith('components/controller/src/') || file.startsWith('components/extension-kit/src/')) &&
    !file.includes('/migrations/');

  const touchedOwners = new Map(); // владелец → файлы сущностей с правкой схемы
  for (const file of changed.filter(inScope)) {
    const absolute = path.join(root, file);
    const now = fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
    const before = sh(`git show ${mergeBase}:${file}`);
    if (!/@(Entity|ViewEntity|ChildEntity)\(/.test(now + before)) continue;
    const tracked = sh(`git ls-files ${file}`).trim();
    const diff = tracked ? sh(`git diff -U0 ${mergeBase} -- ${file}`) : now.split('\n').map((line) => `+${line}`).join('\n');
    const lines = diff.split('\n').filter((line) => /^[+-](?![+-])/.test(line)).map((line) => line.slice(1));
    if (lines.some((line) => /schema-unchanged:/.test(line))) continue;
    if (!lines.some((line) => SCHEMA_LINE.test(line))) continue;
    const owner = schemaOwner(file);
    if (!touchedOwners.has(owner)) touchedOwners.set(owner, []);
    touchedOwners.get(owner).push(file);
  }

  for (const [owner, files] of touchedOwners) {
    const dir = ownerMigrationsDir(owner);
    // Список миграций ядра (`index.ts`) — не миграция: нужна сама миграция.
    if (changed.some((file) => file.startsWith(dir) && /\.ts$/.test(file) && !file.endsWith('/index.ts'))) continue;
    problems.push(
      `${owner === 'core' ? 'ядро' : `расширение ${owner}`}: схема сущностей изменена (${files.join(', ')}), а новой миграции в ${dir} нет — pnpm schema:generate <имя>`
    );
  }
}

if (problems.length) {
  console.error('Схема базы — только миграциями:');
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  process.exit(1);
}
console.log('Схема базы — только миграциями: чисто');
