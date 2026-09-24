/**
 * Генератор стартовых миграций схемы (C28-79). Одноразовый: запускается при
 * переходе с `synchronize` на миграции, дальше схема растёт миграциями
 * `pnpm schema:generate`.
 *
 *   pnpm schema:baseline
 *
 * Как устроено. Во временной базе создаются все таблицы приложения без единой
 * колонки, и TypeORM сам выписывает недостающее — типы, колонки, ключи,
 * индексы. Это ровно тот SQL, который выполнял `synchronize`. Каждая инструкция
 * переводится в идемпотентную форму (см. idempotent-ddl.ts), и всё
 * раскладывается по владельцам: ядро — в `src/infrastructure/database/migrations`,
 * каждое расширение — в свой каталог `migrations/database`.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  CORE_OWNER,
  EXTENSIONS_DIR,
  getOrCreate,
  loadOwners,
  ownerOfStatement,
  migrationsDir,
  ownerClassPrefix,
  pendingSchemaSql,
  renderMigration,
  tableOwners,
  withDataSource,
  withScratchDatabase,
} from './schema-tools';
import {
  createEmptyTable,
  isLegacyTableStep,
  referencedTable,
  repairPartialIndex,
  toIdempotent,
} from '~/infrastructure/database/schema/idempotent-ddl';

interface OwnerPlan {
  tables: string[];
  statements: string[];
  dependsOn: Set<string>;
}

/** Порядок владельцев: ядро первым, расширения — после тех, на чьи таблицы ссылаются. */
function orderOwners(plans: Map<string, OwnerPlan>): string[] {
  const order: string[] = [];
  const visiting = new Set<string>();
  const visit = (owner: string) => {
    if (order.includes(owner)) return;
    if (visiting.has(owner)) throw new Error(`Взаимные внешние ключи между владельцами таблиц: ${owner}`);
    visiting.add(owner);
    for (const dependency of [...(plans.get(owner)?.dependsOn ?? [])].sort()) visit(dependency);
    visiting.delete(owner);
    order.push(owner);
  };
  visit(CORE_OWNER);
  for (const owner of [...plans.keys()].sort()) visit(owner);
  return order;
}

async function main() {
  const owners = loadOwners();
  const plans = new Map<string, OwnerPlan>();
  const planOf = (owner: string) =>
    getOrCreate(plans, owner, () => ({ tables: [], statements: [], dependsOn: new Set<string>() }));

  // Проход 1 — пустая база: полноценное создание всего, путь новой базы.
  const fresh = new Map<string, { structure: string[]; rest: string[] }>();
  await withScratchDatabase('schema_baseline_fresh', (database) =>
    withDataSource(database, async (dataSource) => {
      const ownerByTable = tableOwners(dataSource, owners);
      for (const [table, owner] of [...ownerByTable.entries()].sort()) planOf(owner).tables.push(table);
      const { up } = await pendingSchemaSql(dataSource);
      up.forEach((sql, index) => {
        const owner = ownerOfStatement(sql, index, up, ownerByTable);
        const reference = referencedTable(sql);
        const referenceOwner = reference ? ownerByTable.get(reference) : undefined;
        if (referenceOwner && referenceOwner !== owner) {
          if (owner === CORE_OWNER) throw new Error(`Таблица ядра ссылается на таблицу расширения: ${sql}`);
          planOf(owner).dependsOn.add(referenceOwner);
        }
        const bucket = getOrCreate(fresh, owner, () => ({ structure: [] as string[], rest: [] as string[] }));
        const isStructure = /^CREATE (TYPE|TABLE) /.test(sql);
        (isStructure ? bucket.structure : bucket.rest).push(toIdempotent(sql));
        const repair = repairPartialIndex(sql);
        if (repair) bucket.rest.push(repair);
      });
    })
  );

  // Проход 2 — таблицы без колонок: чем дотянуть таблицу, существовавшую до миграций.
  const legacy = new Map<string, string[]>();
  await withScratchDatabase('schema_baseline_legacy', (database) =>
    withDataSource(database, async (dataSource) => {
      const ownerByTable = tableOwners(dataSource, owners);
      for (const table of ownerByTable.keys()) await dataSource.query(createEmptyTable(table));
      const { up } = await pendingSchemaSql(dataSource);
      up.forEach((sql, index) => {
        if (!isLegacyTableStep(sql)) return;
        const owner = ownerOfStatement(sql, index, up, ownerByTable);
        getOrCreate(legacy, owner, () => [] as string[]).push(toIdempotent(sql));
      });
    })
  );

  for (const [owner, plan] of plans) {
    const bucket = fresh.get(owner) ?? { structure: [], rest: [] };
    plan.statements = [
      ...bucket.structure,
      ...(legacy.get(owner) ?? []),
      ...bucket.rest,
    ];
  }

  const order = orderOwners(plans);
  // Метку можно задать, чтобы перегенерировать файлы на месте, не трогая их регистрацию.
  const base = Number(process.env.SCHEMA_BASELINE_TIMESTAMP ?? Date.now());
  const written: string[] = [];

  order.forEach((owner, position) => {
    const plan = planOf(owner);
    const timestamp = base + position;
    const className = `${ownerClassPrefix(owner)}Baseline${timestamp}`;
    const needsUuid = plan.statements.some((sql) => sql.includes('uuid_generate_v4()'));
    const up = [
      ...(needsUuid ? ['CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'] : []),
      ...plan.statements,
    ];
    const title = owner === CORE_OWNER ? 'ядра' : `расширения «${owner}»`;
    const source = renderMigration({
      className,
      description:
        `Стартовая миграция таблиц ${title}: ${plan.tables.length} таблиц.\n\n` +
        'Идемпотентна: на пустой базе создаёт всё, на базе, которую раньше вёл\n' +
        'synchronize, добавляет только недостающее и ничего не удаляет.',
      up,
      down: null,
    });
    const dir = migrationsDir(owner);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${timestamp}-baseline.ts`);
    fs.writeFileSync(file, source);
    written.push(`${owner}: ${path.relative(process.cwd(), file)} (${plan.tables.length} таблиц, ${up.length} инструкций)`);
  });

  process.stdout.write(`Порядок владельцев: ${order.join(' → ')}\n${written.join('\n')}\n`);
  process.stdout.write(
    `Зарегистрируйте классы: ядро — в src/infrastructure/database/migrations/index.ts, ` +
      `расширения — в ${path.relative(process.cwd(), EXTENSIONS_DIR)}/<имя>/<имя>.database-migrations.ts\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exit(1);
});
