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
 *
 * Что сущности совпадают с миграциями, проверяет `pnpm schema:check` в CI —
 * ему нужна живая база.
 */
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

if (problems.length) {
  console.error('Схема базы — только миграциями:');
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  process.exit(1);
}
console.log('Схема базы — только миграциями: чисто');
