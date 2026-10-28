/**
 * Перенос хранилища фабрики документов из MongoDB в PostgreSQL (шаг 5
 * фабрики v2, FR36–FR37). Запускается на узле один раз, до переключения
 * `FACTORY_STORAGE=postgres`:
 *
 *   pnpm factory:migrate            — перенос и сверка; таблицы PostgreSQL обязаны быть пустыми
 *   pnpm factory:migrate --wipe     — сначала очистить таблицы фабрики в PostgreSQL (стенд, повтор)
 *   pnpm factory:migrate --verify   — только сверка без записи
 *
 * Что переносится: все версии записей всех коллекций данных (физлица,
 * организации, ИП, способы оплаты, переменные, проекты решений, udata,
 * подписи) в порядке вставки, собранные документы с телом PDF, приватные
 * данные документов. Время записи сохраняется из MongoDB.
 *
 * Сверка по каждой коллекции: число записей и совпадение содержимого — набор
 * отпечатков записей (устойчивая сериализация без служебных полей) в MongoDB и
 * в PostgreSQL обязан совпасть как мультимножество. Расхождение — код 1.
 *
 * Архивную выгрузку MongoDB (`mongodump --archive`) делает плейбук до переноса;
 * этот скрипт её не заменяет.
 */
import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import { MongoFactoryStorage, RECORD_COLLECTIONS, type RecordCollection } from '@coopenomics/factory';
import config from '../config/config';

const WIPE = process.argv.includes('--wipe');
const VERIFY_ONLY = process.argv.includes('--verify');

/** Устойчивая сериализация: ключи по алфавиту на каждом уровне. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`);
  return `{${entries.join(',')}}`;
}

function fingerprint(record: Record<string, unknown>): string {
  const { _id: _a, _created_at: _b, ...rest } = record;
  return createHash('sha256').update(stableStringify(rest)).digest('hex');
}

/** Мультимножества отпечатков равны: тот же состав с теми же кратностями. */
function sameMultiset(a: string[], b: string[]): { ok: boolean; onlyInMongo: number; onlyInPostgres: number } {
  const count = (list: string[]) => list.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>());
  const ma = count(a);
  const mb = count(b);
  let onlyInMongo = 0;
  let onlyInPostgres = 0;
  for (const [k, n] of ma) onlyInMongo += Math.max(0, n - (mb.get(k) ?? 0));
  for (const [k, n] of mb) onlyInPostgres += Math.max(0, n - (ma.get(k) ?? 0));
  return { ok: onlyInMongo === 0 && onlyInPostgres === 0, onlyInMongo, onlyInPostgres };
}

interface Report {
  collection: string;
  mongo: number;
  postgres: number;
  ok: boolean;
  onlyInMongo: number;
  onlyInPostgres: number;
}

/** Бинарное тело из BSON Binary или Buffer. */
function toBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value && typeof value === 'object' && 'buffer' in value) return Buffer.from((value as { buffer: Uint8Array }).buffer);
  if (value instanceof Uint8Array) return Buffer.from(value);
  throw new Error('Тело документа не бинарное');
}

async function main(): Promise<void> {
  const mongo = new MongoFactoryStorage(config.mongoose.url);
  await mongo.connect();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = new Kysely<any>({
    dialect: new PostgresDialect({
      pool: new Pool({
        host: config.postgres.host,
        port: config.postgres.port,
        user: config.postgres.username,
        password: config.postgres.password,
        database: config.postgres.database,
      }),
    }),
  });

  const reports: Report[] = [];
  try {
    if (WIPE && !VERIFY_ONLY) {
      await sql`TRUNCATE "factory_records", "factory_documents", "factory_doc_private_data"`.execute(db);
      console.log('Таблицы фабрики в PostgreSQL очищены');
    }

    if (!VERIFY_ONLY) {
      const existing = await db.selectFrom('factory_records').select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirst();
      const existingDocs = await db.selectFrom('factory_documents').select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirst();
      if (Number(existing?.n ?? 0) > 0 || Number(existingDocs?.n ?? 0) > 0) {
        throw new Error('Таблицы фабрики в PostgreSQL не пусты. Повтор переноса — с --wipe, только сверка — с --verify.');
      }
    }

    // Записи данных: все версии в порядке вставки, время записи из MongoDB.
    for (const collection of RECORD_COLLECTIONS) {
      const rows = await mongo.collection(collection).find({}).sort({ _id: 1 }).toArray();
      if (!VERIFY_ONLY) {
        for (const row of rows) {
          const { _id, _created_at, block_num, deleted, ...payload } = row as Record<string, unknown>;
          await db
            .insertInto('factory_records')
            .values({
              collection,
              block_num: typeof block_num === 'number' ? block_num : null,
              deleted: deleted === true,
              created_at: _created_at instanceof Date ? _created_at : (_id as { getTimestamp?: () => Date })?.getTimestamp?.() ?? new Date(),
              payload: JSON.stringify(payload),
            })
            .execute();
        }
      }
      reports.push(await verifyRecords(db, mongo, collection));
    }

    // Документы: версия по хэшу и ключу меты, тело PDF в binary.
    const docs = await mongo.collection('documents').find({}).sort({ _id: 1 }).toArray();
    if (!VERIFY_ONLY) {
      for (const doc of docs) {
        const d = doc as Record<string, unknown>;
        const meta = d.meta as { registry_id: number; block_num?: number };
        await db
          .insertInto('factory_documents')
          .values({
            hash: d.hash,
            meta_key: d.meta_key,
            registry_id: meta.registry_id,
            block_num: meta.block_num ?? null,
            full_title: (d.full_title as string | undefined) ?? null,
            html: d.html,
            meta: JSON.stringify(meta),
            binary: toBuffer(d.binary),
            created_at: (d._id as { getTimestamp?: () => Date })?.getTimestamp?.() ?? new Date(),
          })
          .onConflict((oc) => oc.columns(['hash', 'meta_key']).doNothing())
          .execute();
      }
    }
    reports.push(await verifyDocuments(db, docs as Array<Record<string, unknown>>));

    // Приватные данные документов.
    const privs = await mongo.collection('doc_private_data').find({}).sort({ _id: 1 }).toArray();
    if (!VERIFY_ONLY) {
      for (const p of privs) {
        const r = p as Record<string, unknown>;
        await db
          .insertInto('factory_doc_private_data')
          .values({
            hash: r.hash,
            registry_id: r.registry_id,
            payload: JSON.stringify(r.payload),
            created_at: r._created_at instanceof Date ? r._created_at : new Date(),
          })
          .onConflict((oc) => oc.column('hash').doNothing())
          .execute();
      }
    }
    reports.push(await verifyDocData(db, privs as Array<Record<string, unknown>>));
  } finally {
    await db.destroy();
    await mongo.disconnect();
  }

  console.log('\nСверка переноса хранилища фабрики:');
  console.log('коллекция\tMongoDB\tPostgreSQL\tитог');
  let failed = false;
  for (const r of reports) {
    const verdict = r.ok ? 'совпадает' : `РАСХОЖДЕНИЕ: только в MongoDB ${r.onlyInMongo}, только в PostgreSQL ${r.onlyInPostgres}`;
    console.log(`${r.collection}\t${r.mongo}\t${r.postgres}\t${verdict}`);
    if (!r.ok) failed = true;
  }
  if (failed) {
    console.error('\nПеренос не сверился. FACTORY_STORAGE=postgres включать нельзя.');
    process.exit(1);
  }
  console.log('\nПеренос сверился по всем коллекциям. Можно включать FACTORY_STORAGE=postgres.');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyRecords(db: Kysely<any>, mongo: MongoFactoryStorage, collection: RecordCollection): Promise<Report> {
  const mongoRows = await mongo.collection(collection).find({}).toArray();
  const pgRows = await db.selectFrom('factory_records').select(['block_num', 'deleted', 'payload']).where('collection', '=', collection).execute();
  const a = mongoRows.map((r) => {
    const { _id, _created_at, ...rest } = r as Record<string, unknown>;
    return fingerprint({ ...rest, deleted: rest.deleted === true, block_num: typeof rest.block_num === 'number' ? rest.block_num : undefined });
  });
  const b = pgRows.map((r) =>
    fingerprint({
      ...(r.payload as Record<string, unknown>),
      deleted: r.deleted === true,
      block_num: r.block_num === null || r.block_num === undefined ? undefined : Number(r.block_num),
    })
  );
  return { collection, mongo: a.length, postgres: b.length, ...sameMultiset(a, b) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyDocuments(db: Kysely<any>, docs: Array<Record<string, unknown>>): Promise<Report> {
  const pgRows = await db.selectFrom('factory_documents').select(['hash', 'meta_key', 'html', 'meta', 'binary']).execute();
  const a = docs.map((d) => fingerprint({ hash: d.hash, meta_key: d.meta_key, html: d.html, meta: d.meta, pdf: createHash('sha256').update(toBuffer(d.binary)).digest('hex') }));
  const b = pgRows.map((r) => fingerprint({ hash: r.hash, meta_key: r.meta_key, html: r.html, meta: r.meta, pdf: createHash('sha256').update(r.binary as Buffer).digest('hex') }));
  return { collection: 'documents', mongo: a.length, postgres: b.length, ...sameMultiset(a, b) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyDocData(db: Kysely<any>, privs: Array<Record<string, unknown>>): Promise<Report> {
  const pgRows = await db.selectFrom('factory_doc_private_data').select(['hash', 'registry_id', 'payload']).execute();
  const a = privs.map((p) => fingerprint({ hash: p.hash, registry_id: p.registry_id, payload: p.payload }));
  const b = pgRows.map((r) => fingerprint({ hash: r.hash, registry_id: r.registry_id, payload: r.payload }));
  return { collection: 'doc_private_data', mongo: a.length, postgres: b.length, ...sameMultiset(a, b) };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
