/**
 * Генерация schema.gql (code-first) без HTTP и без инициализации MongoDB / TypeORM / Redis.
 *
 * Env: скрипт npm `generate-schema` подключает `-r ./scripts/register-schema-gen-env.cjs`, который
 * выставляет CONTROLLER_SCHEMA_GEN=1 — тогда в src/config/config.ts подставляются SCHEMA_GEN_ENV_DEFAULTS
 * и Zod не требует полноценного dev-.env. При ручном вызове ts-node добавьте тот же -r или
 * `CONTROLLER_SCHEMA_GEN=1` в окружение.
 *
 * Загрузка модулей: `require()` абсолютного пути к `.ts` (совместимо с tsconfig-paths); `import(file://…)` ломается.
 *
 * Постобработка SDL как в рантайме: docDirectiveTransformer(@auth) + lexicographicSortSchema
 * (см. src/infrastructure/graphql/graphql.module.ts). fieldAuthDirectiveTransformer меняет только
 * resolve-функции и на текст схемы не влияет.
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'node:perf_hooks';
import { glob } from 'glob';
import { lexicographicSortSchema, printSchema } from 'graphql';
import { NestFactory } from '@nestjs/core';
import {
  GRAPHQL_SDL_FILE_END,
  GRAPHQL_SDL_FILE_HEADER,
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
  RESOLVER_TYPE_METADATA,
} from '@nestjs/graphql';
import dotenv from 'dotenv';
import { docDirectiveTransformer } from '~/infrastructure/graphql/directives/doc.directive';

const SCHEMA_FILENAME = 'schema.gql';

/** Ссылка на класс резолвера (Nest GraphQLSchemaFactory ожидает `Function[]`). */
type ResolverCtor = abstract new (...args: never[]) => unknown;

const packageRoot = path.join(__dirname, '..');
dotenv.config({ path: path.join(packageRoot, '.env') });
const envSchemaPath = path.join(packageRoot, '.env.generate-schema');
if (fs.existsSync(envSchemaPath)) {
  const parsed = dotenv.parse(fs.readFileSync(envSchemaPath, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    process.env[key] = value;
  }
}

function collectExportedClasses(moduleExports: Record<string, unknown>): ResolverCtor[] {
  const out: ResolverCtor[] = [];
  for (const v of Object.values(moduleExports)) {
    if (typeof v === 'function') {
      out.push(v as ResolverCtor);
    }
  }
  const defaultExport = moduleExports.default;
  if (typeof defaultExport === 'function') {
    out.push(defaultExport as ResolverCtor);
  }
  return out;
}

function requireResolverModule(filePath: string): Record<string, unknown> {
  const abs = path.resolve(filePath);
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- динамическая загрузка .ts под ts-node + tsconfig-paths
  return require(abs) as Record<string, unknown>;
}

async function discoverResolverClasses(srcRoot: string): Promise<ResolverCtor[]> {
  const pattern = '**/*.resolver.ts';
  const files = (await glob(pattern, { cwd: srcRoot, absolute: true })).sort();
  const classes: ResolverCtor[] = [];
  const seen = new Set<ResolverCtor>();

  for (const file of files) {
    const mod = requireResolverModule(file);
    for (const exp of collectExportedClasses(mod)) {
      if (seen.has(exp)) {
        continue;
      }
      // Важно: используем hasMetadata, а не getMetadata. Для @Resolver() без параметра
      // Nest делает SetMetadata(RESOLVER_TYPE_METADATA, undefined) — defineMetadata
      // реально проставлен, но getMetadata возвращает undefined и неотличим от «не объявлен».
      // hasMetadata это различает и принимает оба случая: @Resolver(() => X) и @Resolver().
      if (!Reflect.hasMetadata(RESOLVER_TYPE_METADATA, exp)) {
        continue;
      }
      seen.add(exp);
      classes.push(exp);
    }
  }
  return classes;
}

async function main(): Promise<void> {
  const started = performance.now();
  const srcRoot = path.join(packageRoot, 'src');
  const outPath = path.join(packageRoot, SCHEMA_FILENAME);

  const resolverClasses = await discoverResolverClasses(srcRoot);
  if (resolverClasses.length === 0) {
    throw new Error(`Не найдено классов резолверов по шаблону ${path.join(srcRoot, '**/*.resolver.ts')}`);
  }

  const ctx = await NestFactory.createApplicationContext(GraphQLSchemaBuilderModule, {
    logger: false,
  });
  try {
    const factory = ctx.get(GraphQLSchemaFactory);
    let schema = await factory.create(
      resolverClasses as unknown as Parameters<GraphQLSchemaFactory['create']>[0],
      { skipCheck: true },
    );
    schema = docDirectiveTransformer(schema, 'auth');
    const body = printSchema(lexicographicSortSchema(schema));
    await fs.promises.writeFile(outPath, `${GRAPHQL_SDL_FILE_HEADER}${body}${GRAPHQL_SDL_FILE_END}`, 'utf8');
  } finally {
    await ctx.close();
  }

  const seconds = (performance.now() - started) / 1000;
  console.log(
    `Схема GraphQL записана: ${outPath} (классов резолверов: ${resolverClasses.length}, время: ${seconds.toFixed(2)} с)`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
