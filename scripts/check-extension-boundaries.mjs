#!/usr/bin/env node
/**
 * Граница расширения: то, что ESLint не видит.
 *
 * `no-restricted-imports` разбирает только статические `import ... from '…'` и
 * сравнивает спецификатор с шаблоном. Мимо него проходят два способа достать
 * ядро из расширения:
 *
 *   1. Динамика — `require('~/domain/…')`, `await import('~/infrastructure/…')`.
 *      Строка вычисляется в рантайме, шаблоны линтера к ней неприменимы.
 *   2. Относительный путь — `../../../../domain/user/…`. Спецификатор не
 *      начинается с `~`, шаблон `~/**` его не ловит, а ведёт он ровно туда же.
 *
 * Оба способа ломают вынос одинаково: в пакете `@coopenomics/extension-<name>`
 * этих файлов нет. Скрипт резолвит каждый путь физически и требует, чтобы он
 * остался внутри каталога своего расширения.
 *
 * Запуск: node scripts/check-extension-boundaries.mjs
 * Код возврата: 0 — чисто, 1 — есть нарушения.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXTENSIONS_DIR = join(REPO_ROOT, 'components/controller/src/extensions');

/**
 * Точки сборки. Им положено знать про всё сразу — это composition root, а не
 * расширение: лежат в корне `extensions/`, в пакет не уезжают.
 */
const COMPOSITION_ROOT = new Set(['extensions.module.ts', 'extensions.registry.ts', 'innercoop-bridge.module.ts']);

/** Тесты живут рядом с кодом и по своей природе лезут куда угодно. */
const isTest = (file) => /\.(spec|test)\.ts$/.test(file);

/**
 * Спецификаторы модулей во всех формах, которыми можно дотянуться до файла:
 * статический импорт и реэкспорт, динамический `import()`, `require()`.
 */
const SPECIFIER_PATTERNS = [
  { kind: 'import', re: /(?:^|[\s;}])(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]/g },
  { kind: 'import', re: /(?:^|[\s;}])import\s*['"]([^'"]+)['"]/g },
  { kind: 'dynamic', re: /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g },
  { kind: 'require', re: /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.ts') && !isTest(entry.name)) out.push(full);
  }
  return out;
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

const violations = [];

const extensionNames = readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

for (const name of extensionNames) {
  const root = join(EXTENSIONS_DIR, name);
  for (const file of walk(root)) {
    if (COMPOSITION_ROOT.has(relative(EXTENSIONS_DIR, file))) continue;

    const source = readFileSync(file, 'utf8');
    for (const { kind, re } of SPECIFIER_PATTERNS) {
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(source)) !== null) {
        const spec = match[1];
        const line = lineOf(source, match.index);

        if (spec.startsWith('~/')) {
          // `~` — алиас на `src` контроллера. Своё расширение через него тоже
          // недостижимо после выноса, но об этом уже говорит ESLint; здесь
          // важен именно динамический путь, который линтер пропускает.
          if (kind !== 'import') {
            violations.push({ file, line, spec, why: `динамический доступ к ядру через алиас ~ (${kind})` });
          }
          continue;
        }

        if (!spec.startsWith('.')) continue; // пакет из node_modules — легитимно

        const target = resolve(dirname(file), spec);
        if (target !== root && !target.startsWith(root + sep)) {
          violations.push({
            file,
            line,
            spec,
            why: `относительный путь ведёт за пределы расширения (${relative(REPO_ROOT, target)})`,
          });
        }
      }
    }
  }
}

/**
 * Вторая проверка: каждая таблица расширения объявлена его файлом
 * `<name>.entities.ts`.
 *
 * Раньше состав таблиц собирал файловый глоб, и забыть про новую сущность было
 * нельзя. Теперь состав объявляется явно (иначе расширение не переживёт выноса
 * в пакет), и забывчивость стала возможной — причём молчаливой: таблица просто
 * не создастся, а упадёт это позже и в другом месте.
 */
const undeclared = [];

for (const name of extensionNames) {
  const root = join(EXTENSIONS_DIR, name);
  const declarationFile = join(root, `${name}.entities.ts`);

  const declared = new Set();
  let declaration = '';
  try {
    declaration = readFileSync(declarationFile, 'utf8');
  } catch {
    declaration = '';
  }
  for (const match of declaration.matchAll(/^\s{2}(\w+),$/gm)) declared.add(match[1]);

  for (const file of walk(root)) {
    if (!/entities[/\\][^/\\]*entity\.ts$/.test(file)) continue;
    const source = readFileSync(file, 'utf8');
    if (!source.includes('@Entity(')) continue;

    for (const match of source.matchAll(/^export class (\w+)/gm)) {
      const cls = match[1];
      if (!declared.has(cls)) {
        undeclared.push({ extension: name, cls, file, declarationFile });
      }
    }
  }
}

if (undeclared.length > 0) {
  console.error(`  таблиц расширений вне декларации: ${undeclared.length}`);
  for (const u of undeclared) {
    console.error(`    ${relative(REPO_ROOT, u.file)}  класс ${u.cls}`);
    console.error(`      не объявлен в ${relative(REPO_ROOT, u.declarationFile)}`);
  }
  console.error('');
  console.error('  Состав таблиц расширение объявляет само: файлового глоба больше нет,');
  console.error('  необъявленная сущность молча не доедет до базы.');
  process.exit(1);
}

/**
 * Третья проверка: расширение не пользуется портом, которого нет в его
 * capability-заявке (ADR-16).
 *
 * Мост раздаёт токены глобально — на уровне DI ограничить выдачу «этому
 * расширению только это» нельзя, не размножая модули. Поэтому заявка
 * проверяется здесь, статически: незаявленный порт не пройдёт сборку. Плюс
 * рантайм-проверка при запуске расширения — та ловит обратный случай, когда
 * заявленного порта в контуре нет.
 */
const unrequested = [];

for (const name of extensionNames) {
  const root = join(EXTENSIONS_DIR, name);
  const used = new Set();

  for (const file of walk(root)) {
    if (file === join(root, `${name}.ports.ts`)) continue;
    const source = readFileSync(file, 'utf8');
    for (const block of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'@coopenomics\/innercoop'/gs)) {
      for (const raw of block[1].split(',')) {
        const token = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
        if (token.endsWith('_PORT')) used.add(token);
      }
    }
  }

  if (used.size === 0) continue;

  let declaration = '';
  try {
    declaration = readFileSync(join(root, `${name}.ports.ts`), 'utf8');
  } catch {
    declaration = '';
  }
  const declared = new Set(
    [...declaration.matchAll(/^\s{4}(\w+_PORT),$/gm)].map((match) => match[1])
  );

  for (const token of used) {
    if (!declared.has(token)) unrequested.push({ extension: name, token });
  }
}

if (unrequested.length > 0) {
  console.error(`  портов вне capability-заявки: ${unrequested.length}`);
  for (const u of unrequested) {
    console.error(`    расширение ${u.extension} пользуется ${u.token}, не объявив его`);
    console.error(`      объявить в components/controller/src/extensions/${u.extension}/${u.extension}.ports.ts`);
  }
  console.error('');
  console.error('  Заявка — это то, что расширению позволено просить у кооператива.');
  console.error('  Молча взятый порт делает её недостоверной, а установку — непроверяемой.');
  process.exit(1);
}

if (violations.length === 0) {
  console.log(
    `  расширений проверено: ${extensionNames.length}; ` +
      'выходов за границу нет, таблицы объявлены, порты в пределах заявок'
  );
  process.exit(0);
}

console.error(`  выходов за границу расширения: ${violations.length}`);
for (const v of violations) {
  console.error(`    ${relative(REPO_ROOT, v.file)}:${v.line}  '${v.spec}'`);
  console.error(`      ${v.why}`);
}
console.error('');
console.error('  Расширение обязано собираться за пределами контроллера: этих файлов');
console.error('  в пакете @coopenomics/extension-<name> не будет. Ядро — через порт');
console.error('  @coopenomics/innercoop, каркас — через @coopenomics/extension-kit.');
process.exit(1);
