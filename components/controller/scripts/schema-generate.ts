/**
 * Заготовка новой миграции схемы (C28-79, C28-81).
 *
 *   pnpm schema:generate <имя_латиницей> [владелец]
 *
 * Владелец — `core` (по умолчанию) либо каталог расширения: правка таблицы
 * ядра идёт в миграции ядра, правка таблицы расширения — в каталог расширения.
 * Команда создаёт файл с меткой времени в имени и регистрирует его в списке
 * владельца; инструкции SQL автор вписывает сам. После правки — `pnpm
 * schema:check` и `pnpm schema:types`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CORE_OWNER, EXTENSIONS_DIR, migrationsDir, ownerClassPrefix, renderMigration } from './schema-tools';

/** Имя класса из имени миграции: `add_member_since` → `AddMemberSince`. */
function pascal(name: string): string {
  return name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** Список, в который владелец складывает свои миграции. */
function registryFile(owner: string): string {
  return owner === CORE_OWNER
    ? path.join(migrationsDir(CORE_OWNER), 'index.ts')
    : path.join(EXTENSIONS_DIR, owner, `${owner}.database-migrations.ts`);
}

/** Дописать класс в список владельца: импорт и элемент массива. */
function register(owner: string, className: string, file: string): void {
  const list = registryFile(owner);
  if (!fs.existsSync(list)) {
    throw new Error(`У владельца ${owner} нет списка миграций ${list}: заведите его и объявите в записи реестра`);
  }
  let source = fs.readFileSync(list, 'utf8');
  const relative = `./${path.relative(path.dirname(list), file).replace(/\.ts$/, '')}`;
  const lines = source.split('\n');
  const lastImport = lines.reduce((last, line, index) => (line.startsWith('import ') ? index : last), -1);
  lines.splice(lastImport + 1, 0, `import { ${className} } from '${relative}';`);
  source = lines.join('\n');
  const array = /(= \[)([^\]]*)(\];)/;
  if (!array.test(source)) throw new Error(`В ${list} не найден список миграций`);
  source = source.replace(array, (_, open, items: string, close) => {
    const existing = items.trim().replace(/,$/, '');
    return `${open}${existing ? `${existing}, ` : ''}${className}${close}`;
  });
  fs.writeFileSync(list, source);
}

function main() {
  const [name, owner = CORE_OWNER] = process.argv.slice(2);
  if (!name || !/^[a-z][a-z0-9_]*$/.test(name)) {
    process.stderr.write('Использование: pnpm schema:generate <имя_латиницей_через_подчёркивание> [core|расширение]\n');
    process.exit(1);
  }
  if (owner !== CORE_OWNER && !fs.existsSync(path.join(EXTENSIONS_DIR, owner))) {
    process.stderr.write(`Расширения ${owner} нет в ${EXTENSIONS_DIR}\n`);
    process.exit(1);
  }
  const timestamp = Date.now();
  const className = `${ownerClassPrefix(owner)}${pascal(name)}${timestamp}`;
  const dir = migrationsDir(owner);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${timestamp}-${name.replace(/_/g, '-')}.ts`);
  fs.writeFileSync(
    file,
    renderMigration({
      className,
      description: `${name.replace(/_/g, ' ')} — таблицы ${owner === CORE_OWNER ? 'ядра' : `расширения «${owner}»`}.`,
    })
  );
  register(owner, className, file);
  process.stdout.write(`${owner}: ${path.relative(process.cwd(), file)}\n`);
  process.stdout.write('Впишите SQL, затем pnpm schema:check и pnpm schema:types\n');
  // Общие части команд подключают реестр расширений, а он держит соединения открытыми.
  process.exit(0);
}

main();
