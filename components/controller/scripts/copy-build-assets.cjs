/**
 * Перенос неисходных файлов в сборку.
 *
 * Компилятор переносит только .ts, а рядом с кодом живут файлы, которые он
 * читает с диска в рантайме: XSD-схемы отчётности и манифесты расширений.
 * Без них собранный контроллер стартует, но отчётность падает на валидации,
 * а реестр расширений недосчитывается установленных.
 */
const fs = require('fs');
const path = require('path');

const packageRoot = path.resolve(__dirname, '..');
const source = path.join(packageRoot, 'src');
const target = path.join(packageRoot, 'dist', 'src');

/**
 * Исходники компилируются, мусор macOS не нужен. Описания расширений (README,
 * INSTALL) переносятся: реестр расширений читает их с диска и отдаёт в UI.
 */
const SKIP_EXTENSIONS = new Set(['.ts']);
const SKIP_NAMES = new Set(['.DS_Store']);

let copied = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const from = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(from);
      continue;
    }
    if (SKIP_NAMES.has(entry.name) || SKIP_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }
    const to = path.join(target, path.relative(source, from));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    copied += 1;
  }
}

walk(source);
console.log(`Ассеты перенесены в сборку: ${copied} файлов`);
