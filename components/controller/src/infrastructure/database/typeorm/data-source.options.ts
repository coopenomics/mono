import path from 'node:path';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { extensionDatabaseMigrations, extensionEntities } from '@coopenomics/extension-kit';
import {
  EntityVersionTypeormEntity,
  InvalidatedEntityTypeormEntity,
  InvalidatedEntityVersionTypeormEntity,
} from '@coopenomics/extension-kit/sync';
import config from '~/config/config';
import { coreDatabaseMigrations } from '../migrations';

/** Таблица учёта применённых миграций схемы. `migrations` занята мигратором данных. */
export const DATABASE_MIGRATIONS_TABLE = 'schema_migrations';

/**
 * Подключение к основной базе кооператива — одно описание для приложения,
 * мигратора и команд `schema:*`.
 *
 * Схема меняется только миграциями: `synchronize` выключен. Он удалял колонку,
 * которой нет в сущности, превращал переименование в «удалить + добавить», а в
 * blue-green выкатке правил общую базу, пока старая версия ещё работала.
 *
 * Состав сущностей и миграций расширений читается из реестра, поэтому функцию
 * зовут после того, как composition root его заполнил (импорт `extensions.registry`).
 *
 * @param database — имя базы; по умолчанию база кооператива из конфига.
 */
export function mainDataSourceOptions(database: string = config.postgres.database): PostgresConnectionOptions {
  const src = path.join(__dirname, '../../..');
  return {
    type: 'postgres',
    host: config.postgres.host,
    port: Number(config.postgres.port),
    username: config.postgres.username,
    password: config.postgres.password,
    database,
    entities: [
      // Глоб от каталога самого модуля, а не от места запуска: в контейнере
      // выполняется сборка (`dist/src/...`), и путь «src/...» не нашёл бы
      // ни одной таблицы.
      path.join(src, 'infrastructure/**/entities/*entity.{ts,js}'),
      path.join(src, 'shared/**/entities/*entity.{ts,js}'),
      // Таблица версий и архив снесённых форком записей приехали в
      // @coopenomics/extension-kit/sync вместе с каркасом синхронизации, и глоб
      // по `src/` их не находит — перечислены классами. Базовые классы каркаса
      // (BaseTypeormEntity) не @Entity: их колонки TypeORM берёт по цепочке
      // прототипов наследника.
      EntityVersionTypeormEntity,
      InvalidatedEntityTypeormEntity,
      InvalidatedEntityVersionTypeormEntity,
      // Таблицы расширений — по декларации самого расширения, а не по его
      // положению на диске: установленное пакетом расширение ни под какой
      // глоб по `src/` не попадёт.
      ...extensionEntities(),
    ],
    migrations: [...coreDatabaseMigrations, ...extensionDatabaseMigrations()],
    migrationsTableName: DATABASE_MIGRATIONS_TABLE,
    synchronize: false,
    logging: false,
  };
}
