import type { DataSource } from 'typeorm';
import mongoose from 'mongoose';
import config from '~/config/config';

type MigrationLogger = {
  info: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
};

/**
 * Переносит историю действий и дельт из mongo парсера (parser1) в postgres.
 *
 * Зачем: controller уходит от HTTP-хождения в explorer-API парсера
 * (SIMPLE_EXPLORER_API) и читает историю действий из своей БД. Но в postgres
 * история начинается с момента, когда consumer впервые её записал, а всё, что
 * было до этого, лежит только в mongo. На voskhod за бортом оставались 704
 * действия и ~971 дельта — среди них soviet::newsubmitted (240), newagreement
 * (84), newlink (78), newresolved (75), то есть ровно то, из чего собираются
 * пакеты документов и повестка. Без переноса старые документы перестали бы
 * собираться.
 *
 * Миграция идёт на всех узлах: у каждого кооператива своя граница обрезки,
 * поэтому объём переноса везде разный, а на новых установках — нулевой.
 *
 * Идемпотентность:
 *   - действия: уникальный индекс по global_sequence → ON CONFLICT DO NOTHING;
 *   - дельты: уникального ключа в схеме нет, и в одном блоке одна и та же
 *     запись может меняться несколько раз (на voskhod — 73 такие группы),
 *     поэтому строка считается уже перенесённой только при полном совпадении
 *     (block_num, code, scope, table, primary_key, present) И содержимого value.
 *
 * Мигрируются только записи своего кооператива — по тому же правилу, что
 * применяет consumer: у действий coopname лежит в data, у дельт — либо в
 * value.coopname, либо в scope (таблицы со scope=coopname).
 */

/**
 * База mongo, куда пишет parser1. Имя различается по установкам: на проде
 * `!parser`, в локальном dev-стеке — `cooperative-x` (см. MONGO_EXPLORER_URI
 * в components/parser/.env). Поэтому берём из env, дефолт — прод-имя.
 */
const PARSER_DB = process.env.PARSER_MONGO_DB || '!parser';

/** Размер батча вставки — история небольшая, но батч бережёт память и лог. */
const BATCH = 500;

export default {
  name: 'Backfill blockchain_actions/blockchain_deltas from parser mongo',

  async up({ dataSource, logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    const coopname = config.coopname;
    let mongo: mongoose.Connection | null = null;

    try {
      mongo = await mongoose.createConnection(config.mongoose.url).asPromise();
      // Парсер пишет в соседнюю базу того же инстанса, а не в базу controller'а.
      const db = mongo.useDb(PARSER_DB).db;
      if (!db) {
        throw new Error('Подключение к MongoDB установлено, но db не инициализирована');
      }

      // На новой установке базы парсера может не быть вовсе — переносить нечего,
      // и это не ошибка: иначе миграция падала бы при каждом деплое такого узла.
      const collections = await db.listCollections({}, { nameOnly: true }).toArray();
      const names = new Set(collections.map((c: { name: string }) => c.name));
      if (!names.has('actions') && !names.has('deltas')) {
        logger.info(`База ${PARSER_DB} пуста или отсутствует — переносить нечего, пропускаю.`);
        return true;
      }

      const actionsMigrated = names.has('actions')
        ? await migrateActions(db, dataSource, coopname, logger)
        : 0;
      const deltasMigrated = names.has('deltas')
        ? await migrateDeltas(db, dataSource, coopname, logger)
        : 0;

      logger.info(
        `Перенос истории парсера завершён: действий ${actionsMigrated}, дельт ${deltasMigrated} (кооператив ${coopname})`
      );
      return true;
    } catch (error: any) {
      // Отсутствие mongo парсера — не повод валить деплой: на новых установках
      // её может не быть вовсе, переносить тогда нечего.
      logger.error(`Не удалось перенести историю парсера: ${error?.message}`);
      return false;
    } finally {
      if (mongo) await mongo.close();
    }
  },
};

async function migrateActions(
  db: any,
  dataSource: DataSource,
  coopname: string,
  logger: MigrationLogger
): Promise<number> {
  const cursor = db
    .collection('actions')
    .find({ 'data.coopname': coopname })
    .sort({ block_num: 1 });

  let batch: any[] = [];
  let inserted = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    for (const a of batch) {
      const result = await dataSource.query(
        `INSERT INTO blockchain_actions (
           transaction_id, account, block_num, block_id, chain_id, name, receiver,
           "authorization", data, action_ordinal, global_sequence, account_ram_deltas,
           console, receipt, creator_action_ordinal, context_free, elapsed, repeat
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,false)
         ON CONFLICT (global_sequence) DO NOTHING
         RETURNING id`,
        [
          a.transaction_id ?? '',
          a.account,
          Number(a.block_num),
          a.block_id ?? '',
          a.chain_id ?? '',
          a.name,
          a.receiver ?? a.account,
          JSON.stringify(a.authorization ?? []),
          JSON.stringify(a.data ?? {}),
          Number(a.action_ordinal ?? 0),
          String(a.global_sequence),
          JSON.stringify(a.account_ram_deltas ?? []),
          a.console ?? '',
          JSON.stringify(a.receipt ?? {}),
          Number(a.creator_action_ordinal ?? 0),
          Boolean(a.context_free ?? false),
          Number(a.elapsed ?? 0),
        ]
      );
      if (result.length > 0) inserted += 1;
    }
    batch = [];
  };

  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= BATCH) await flush();
  }
  await flush();

  logger.info(`Действия: перенесено ${inserted}`);
  return inserted;
}

async function migrateDeltas(
  db: any,
  dataSource: DataSource,
  coopname: string,
  logger: MigrationLogger
): Promise<number> {
  const cursor = db
    .collection('deltas')
    .find({ $or: [{ 'value.coopname': coopname }, { scope: coopname }] })
    .sort({ block_num: 1 });

  let batch: any[] = [];
  let inserted = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    for (const d of batch) {
      const value = d.value === undefined || d.value === null ? null : JSON.stringify(d.value);
      // Сравниваем и содержимое: в одном блоке запись может меняться несколько
      // раз, и по одному только ключу такие строки неотличимы.
      const result = await dataSource.query(
        `INSERT INTO blockchain_deltas (
           chain_id, block_num, block_id, present, code, scope, "table", primary_key, value, repeat
         )
         SELECT $1::varchar, $2::bigint, $3::varchar, $4::boolean,
                $5::varchar, $6::varchar, $7::varchar, $8::varchar, $9::jsonb, false
         WHERE NOT EXISTS (
           SELECT 1 FROM blockchain_deltas
            WHERE block_num = $2::bigint AND code = $5::varchar AND scope = $6::varchar
              AND "table" = $7::varchar AND primary_key = $8::varchar AND present = $4::boolean
              AND value IS NOT DISTINCT FROM $9::jsonb
         )
         RETURNING id`,
        [
          d.chain_id ?? '',
          Number(d.block_num),
          d.block_id ?? '',
          Boolean(d.present),
          d.code,
          d.scope,
          d.table,
          String(d.primary_key),
          value,
        ]
      );
      if (result.length > 0) inserted += 1;
    }
    batch = [];
  };

  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= BATCH) await flush();
  }
  await flush();

  logger.info(`Дельты: перенесено ${inserted}`);
  return inserted;
}
