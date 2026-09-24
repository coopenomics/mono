/**
 * Новая миграция схемы по правке сущностей (C28-79).
 *
 *   pnpm schema:generate <имя_латиницей>
 *
 * Во временной базе применяются все миграции, затем TypeORM выписывает, чем эта
 * база отличается от сущностей. Инструкции раскладываются по владельцам таблиц:
 * правка таблицы ядра — в миграции ядра, правка таблицы расширения — в каталог
 * расширения. Файл регистрируется в списке владельца сам.
 *
 * Сгенерированный SQL — черновик, а не истина: переименование колонки TypeORM
 * выписывает как «удалить + добавить», и такую миграцию надо переписать руками
 * (`ALTER TABLE … RENAME COLUMN`), иначе данные колонки пропадут.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  CORE_OWNER,
  getOrCreate,
  loadOwners,
  migrationsDir,
  ownerClassPrefix,
  ownerOfStatement,
  pendingSchemaSql,
  renderMigration,
  tableOwners,
  withDataSource,
  withScratchDatabase,
} from './schema-tools';

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
    : path.join(path.dirname(migrationsDir(owner)), '..', `${owner}.database-migrations.ts`);
}

/** Дописать класс в список владельца: импорт и элемент массива. */
function register(owner: string, className: string, file: string): void {
  const list = registryFile(owner);
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

async function main() {
  const name = process.argv[2];
  if (!name || !/^[a-z][a-z0-9_]*$/.test(name)) {
    process.stderr.write('Использование: pnpm schema:generate <имя_латиницей_через_подчёркивание>\n');
    process.exit(1);
  }

  const owners = loadOwners();
  const plan = new Map<string, { up: string[]; down: string[] }>();

  await withScratchDatabase('schema_generate', (database) =>
    withDataSource(database, async (dataSource) => {
      await dataSource.runMigrations({ transaction: 'each' });
      const ownerByTable = tableOwners(dataSource, owners);
      const { up, down } = await pendingSchemaSql(dataSource);
      up.forEach((sql, index) => {
        const owner = ownerOfStatement(sql, index, up, ownerByTable);
        const entry = getOrCreate(plan, owner, () => ({ up: [] as string[], down: [] as string[] }));
        entry.up.push(sql);
        // Откат идёт в обратном порядке: TypeORM отдаёт пары «вперёд/назад» по индексу.
        if (down[index]) entry.down.unshift(down[index]);
      });
    })
  );

  if (!plan.size) {
    process.stdout.write('Сущности совпадают с миграциями — генерировать нечего\n');
    return;
  }

  const base = Date.now();
  [...plan.keys()]
    .sort((a, b) => (a === CORE_OWNER ? -1 : b === CORE_OWNER ? 1 : a.localeCompare(b)))
    .forEach((owner, position) => {
      const { up, down } = getOrCreate(plan, owner, () => ({ up: [] as string[], down: [] as string[] }));
      const timestamp = base + position;
      const className = `${ownerClassPrefix(owner)}${pascal(name)}${timestamp}`;
      const dir = migrationsDir(owner);
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${timestamp}-${name.replace(/_/g, '-')}.ts`);
      fs.writeFileSync(
        file,
        renderMigration({
          className,
          description: `${name.replace(/_/g, ' ')} — таблицы ${owner === CORE_OWNER ? 'ядра' : `расширения «${owner}»`}.`,
          up,
          down,
        })
      );
      register(owner, className, file);
      process.stdout.write(`${owner}: ${path.relative(process.cwd(), file)} (${up.length} инструкций)\n`);
    });
  process.stdout.write('Проверьте SQL (переименования, NOT NULL на заполненных таблицах) и запустите pnpm schema:check\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exit(1);
  });
