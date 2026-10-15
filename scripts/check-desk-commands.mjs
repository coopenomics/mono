#!/usr/bin/env node
// Гейт команд столов (C28-86).
//
// Команда стола запускается из окна столов (⌘K) и сочетанием клавиш с любой
// страницы, поэтому ошибка в её объявлении — это действие, открытое не тому
// пайщику, или сочетание, которое тихо перехватывает чужое. Гейт проверяет
// объявления в components/desktop/extensions/*/install.ts до запуска:
//
//   - у команды есть право `requires` — права команд только серверные (гранты);
//   - действие ровно одно: `route`, `action` или `dialog`;
//   - `route` ведёт на маршрут, объявленный в том же install.ts;
//   - ключи команд уникальны;
//   - сочетание — ведущая клавиша и буква, и оно одно на все приложения.
//
// Ведущие клавиши читаются из src/shared/lib/shortcuts/keys.ts — список живёт
// в одном месте.
//
// Запуск: node scripts/check-desk-commands.mjs   (входит в `pnpm check`)

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESKTOP = join(REPO_ROOT, 'components/desktop');
const EXTENSIONS = join(DESKTOP, 'extensions');
const KEYS_FILE = join(DESKTOP, 'src/shared/lib/shortcuts/keys.ts');

const leadersMatch = readFileSync(KEYS_FILE, 'utf8').match(/SHORTCUT_LEADERS\s*=\s*\[([^\]]*)\]/);
if (!leadersMatch) {
  console.log(`  не найден SHORTCUT_LEADERS в ${relative(REPO_ROOT, KEYS_FILE)}`);
  process.exit(1);
}
const LEADERS = [...leadersMatch[1].matchAll(/'([A-Z0-9])'/g)].map((m) => m[1]);

/** Содержимое массива после `commands: [` с учётом вложенных скобок и строк. */
function commandBlocks(source) {
  const blocks = [];
  const re = /\bcommands\s*:\s*\[/g;
  let m;
  while ((m = re.exec(source))) {
    let depth = 1;
    let i = re.lastIndex;
    let quote = null;
    for (; i < source.length && depth > 0; i++) {
      const c = source[i];
      if (quote) {
        if (c === '\\') i++;
        else if (c === quote) quote = null;
      } else if (c === "'" || c === '"' || c === '`') quote = c;
      else if (c === '[') depth++;
      else if (c === ']') depth--;
    }
    blocks.push(source.slice(re.lastIndex, i - 1));
  }
  return blocks;
}

/** Объекты верхнего уровня внутри блока команд. */
function commandObjects(block) {
  const objects = [];
  let depth = 0;
  let start = -1;
  let quote = null;
  for (let i = 0; i < block.length; i++) {
    const c = block[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) objects.push(block.slice(start, i + 1));
    }
  }
  return objects;
}

const field = (obj, name) => obj.match(new RegExp(`\\b${name}\\s*:\\s*'([^']*)'`))?.[1];

const errors = [];
const ids = new Map();
const shortcuts = new Map();
let total = 0;

const dirs = existsSync(EXTENSIONS) ? readdirSync(EXTENSIONS) : [];
for (const dir of dirs) {
  const file = join(EXTENSIONS, dir, 'install.ts');
  if (!existsSync(file)) continue;
  const source = readFileSync(file, 'utf8');
  const rel = relative(REPO_ROOT, file);
  // Имена маршрутов — из файла без блоков команд: иначе `route: { name }`
  // самой команды нашёл бы сам себя.
  const withoutCommands = commandBlocks(source).reduce((text, block) => text.replace(block, ''), source);
  const routeNames = new Set([...withoutCommands.matchAll(/\bname\s*:\s*'([^']+)'/g)].map((m) => m[1]));

  for (const block of commandBlocks(source)) {
    for (const obj of commandObjects(block)) {
      total++;
      const id = field(obj, 'id') ?? '(без id)';
      const where = `${rel}: команда «${id}»`;

      if (ids.has(id)) errors.push(`${where} — ключ уже занят в ${ids.get(id)}`);
      else ids.set(id, rel);

      if (!field(obj, 'requires')) {
        errors.push(`${where} — нет права requires: права команд только серверные (гранты стола)`);
      }

      const kinds = ['route', 'action', 'dialog'].filter((k) => new RegExp(`\\b${k}\\s*:`).test(obj));
      if (kinds.length !== 1) {
        errors.push(`${where} — действие должно быть одно из route | action | dialog, найдено: ${kinds.join(', ') || 'ничего'}`);
      }

      const route = obj.match(/\broute\s*:\s*\{\s*name\s*:\s*'([^']+)'/)?.[1];
      if (route && !routeNames.has(route)) {
        errors.push(`${where} — маршрута «${route}» нет в этом install.ts`);
      }

      const shortcut = field(obj, 'shortcut');
      if (shortcut !== undefined) {
        const keys = shortcut.trim().toUpperCase().split(/\s+/);
        const valid = keys.length === 2 && LEADERS.includes(keys[0]) && /^[A-Z0-9]$/.test(keys[1]);
        if (!valid) {
          errors.push(`${where} — сочетание «${shortcut}»: нужна ведущая клавиша (${LEADERS.join(', ')}) и буква`);
        } else {
          const key = keys.join(' ');
          if (shortcuts.has(key)) errors.push(`${where} — сочетание «${key}» уже у команды ${shortcuts.get(key)}`);
          else shortcuts.set(key, `«${id}»`);
        }
      }
    }
  }
}

if (errors.length) {
  for (const e of errors) console.log(`  ✗ ${e}`);
  process.exit(1);
}
console.log(`  команд столов: ${total}, сочетаний: ${shortcuts.size}, ведущие клавиши: ${LEADERS.join(', ')}`);
