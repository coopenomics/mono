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
 * этот скрипт её не заменяет. Сообщения скрипта читает оператор узла в
 * консоли, до пайщика они не доходят.
 */
import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import { MongoFactoryStorage, RECORD_COLLECTIONS, type RecordCollection } from '@coopenomics/factory';
import config from '../config/config';

const WIPE = process.argv.includes('--wipe');
const VERIFY_ONLY = process.argv.includes('--verify');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = Kysely<any>;
type Raw = Record<string, unknown>;

interface Report {
  collection: string;
  mongo: number;
  postgres: number;
  ok: boolean;
  onlyInMongo: number;
  onlyInPostgres: number;
}

/** Устойчивая сериализация: ключи по алфавиту на каждом уровне. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.keys(value as Raw)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Raw)[k])}`);
  return `{${entries.join(',')}}`;
}

function fingerprint(record: Raw): string {
  const { _id: _a, _created_at: _b, ...rest } = record;
  return createHash('sha256').update(stableStringify(rest)).digest('hex');
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/** Мультимножества отпечатков равны: тот же состав с теми же кратностями. */
function sameMultiset(a: string[], b: string[]): Pick<Report, 'ok' | 'onlyInMongo' | 'onlyInPostgres'> {
  const count = (list: string[]) => list.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>());
  const ma = count(a);
  const mb = count(b);
  let onlyInMongo = 0;
  let onlyInPostgres = 0;
  for (const [k, n] of ma) onlyInMongo += Math.max(0, n - (mb.get(k) ?? 0));
  for (const [k, n] of mb) onlyInPostgres += Math.max(0, n - (ma.get(k) ?? 0));
  return { ok: onlyInMongo === 0 && onlyInPostgres === 0, onlyInMongo, onlyInPostgres };
}

/** Бинарное тело из BSON Binary или Buffer. */
function toBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (value && typeof value === 'object' && 'buffer' in value) return Buffer.from((value as { buffer: Uint8Array }).buffer);
  // i18n-ignore: вывод скрипта оператора узла, до пайщика не доходит
  throw new Error('Тело документа не бинарное');
}

/** Время записи: из `_created_at`, иначе из ObjectId, иначе сейчас. */
function createdAt(row: Raw): Date {
  if (row._created_at instanceof Date) return row._created_at;
  const id = row._id as { getTimestamp?: () => Date } | undefined;
  return id?.getTimestamp?.() ?? new Date();
}

function createDb(): Db {
  return new Kysely({
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
}

async function ensureEmpty(db: Db): Promise<void> {
  const records = await db.selectFrom('factory_records').select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirst();
  const docs = await db.selectFrom('factory_documents').select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirst();
  if (Number(records?.n ?? 0) > 0 || Number(docs?.n ?? 0) > 0) {
    // i18n-ignore: вывод скрипта оператора узла, до пайщика не доходит
    throw new Error('Таблицы фабрики в PostgreSQL не пусты. Повтор переноса — с --wipe, только сверка — с --verify.');
  }
}

async function copyRecords(db: Db, mongo: MongoFactoryStorage, collection: RecordCollection): Promise<void> {
  const rows = await mongo.collection(collection).find({}).sort({ _id: 1 }).toArray();
  for (const row of rows as Raw[]) {
    const { _id, _created_at, block_num, deleted, ...payload } = row;
    await db
      .insertInto('factory_records')
      .values({
        collection,
        block_num: typeof block_num === 'number' ? block_num : null,
        deleted: deleted === true,
        created_at: createdAt(row),
        payload: JSON.stringify(payload),
      })
      .execute();
  }
}

async function copyDocuments(db: Db, docs: Raw[]): Promise<void> {
  for (const d of docs) {
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
        created_at: createdAt(d),
      })
      .onConflict((oc) => oc.columns(['hash', 'meta_key']).doNothing())
      .execute();
  }
}

async function copyDocData(db: Db, privs: Raw[]): Promise<void> {
  for (const r of privs) {
    await db
      .insertInto('factory_doc_private_data')
      .values({ hash: r.hash, registry_id: r.registry_id, payload: JSON.stringify(r.payload), created_at: createdAt(r) })
      .onConflict((oc) => oc.column('hash').doNothing())
      .execute();
  }
}

function recordFingerprint(payload: Raw, deleted: unknown, block_num: unknown): string {
  return fingerprint({
    ...payload,
    deleted: deleted === true,
    block_num: block_num === null || block_num === undefined ? undefined : Number(block_num),
  });
}

async function verifyRecords(db: Db, mongo: MongoFactoryStorage, collection: RecordCollection): Promise<Report> {
  const mongoRows = (await mongo.collection(collection).find({}).toArray()) as Raw[];
  const pgRows = await db.selectFrom('factory_records').select(['block_num', 'deleted', 'payload']).where('collection', '=', collection).execute();
  const a = mongoRows.map((r) => {
    const { _id, _created_at, deleted, block_num, ...rest } = r;
    return recordFingerprint(rest, deleted, typeof block_num === 'number' ? block_num : undefined);
  });
  const b = pgRows.map((r) => recordFingerprint(r.payload as Raw, r.deleted, r.block_num));
  return { collection, mongo: a.length, postgres: b.length, ...sameMultiset(a, b) };
}

async function verifyDocuments(db: Db, docs: Raw[]): Promise<Report> {
  const pgRows = await db.selectFrom('factory_documents').select(['hash', 'meta_key', 'html', 'meta', 'binary']).execute();
  const a = docs.map((d) => fingerprint({ hash: d.hash, meta_key: d.meta_key, html: d.html, meta: d.meta, pdf: sha256(toBuffer(d.binary)) }));
  const b = pgRows.map((r) => fingerprint({ hash: r.hash, meta_key: r.meta_key, html: r.html, meta: r.meta, pdf: sha256(r.binary as Buffer) }));
  return { collection: 'documents', mongo: a.length, postgres: b.length, ...sameMultiset(a, b) };
}

async function verifyDocData(db: Db, privs: Raw[]): Promise<Report> {
  const pgRows = await db.selectFrom('factory_doc_private_data').select(['hash', 'registry_id', 'payload']).execute();
  const a = privs.map((p) => fingerprint({ hash: p.hash, registry_id: p.registry_id, payload: p.payload }));
  const b = pgRows.map((r) => fingerprint({ hash: r.hash, registry_id: r.registry_id, payload: r.payload }));
  return { collection: 'doc_private_data', mongo: a.length, postgres: b.length, ...sameMultiset(a, b) };
}

async function migrate(db: Db, mongo: MongoFactoryStorage): Promise<Report[]> {
  const reports: Report[] = [];
  if (WIPE && !VERIFY_ONLY) {
    await sql`TRUNCATE "factory_records", "factory_documents", "factory_doc_private_data"`.execute(db);
  }
  if (!VERIFY_ONLY) await ensureEmpty(db);

  for (const collection of RECORD_COLLECTIONS) {
    if (!VERIFY_ONLY) await copyRecords(db, mongo, collection);
    reports.push(await verifyRecords(db, mongo, collection));
  }

  const docs = (await mongo.collection('documents').find({}).sort({ _id: 1 }).toArray()) as Raw[];
  if (!VERIFY_ONLY) await copyDocuments(db, docs);
  reports.push(await verifyDocuments(db, docs));

  const privs = (await mongo.collection('doc_private_data').find({}).sort({ _id: 1 }).toArray()) as Raw[];
  if (!VERIFY_ONLY) await copyDocData(db, privs);
  reports.push(await verifyDocData(db, privs));
  return reports;
}

/** Таблица сверки в консоль; возвращает, сошлось ли всё. */
function printReport(reports: Report[]): boolean {
  // i18n-ignore: вывод скрипта оператора узла, до пайщика не доходит
  console.log('\nСверка переноса хранилища фабрики:\nколлекция\tMongoDB\tPostgreSQL\tитог');
  let ok = true;
  for (const r of reports) {
    // i18n-ignore: вывод скрипта оператора узла, до пайщика не доходит
    const verdict = r.ok ? 'совпадает' : `РАСХОЖДЕНИЕ: только в MongoDB ${r.onlyInMongo}, только в PostgreSQL ${r.onlyInPostgres}`;
    console.log(`${r.collection}\t${r.mongo}\t${r.postgres}\t${verdict}`);
    if (!r.ok) ok = false;
  }
  // i18n-ignore: вывод скрипта оператора узла, до пайщика не доходит
  console.log(ok ? '\nПеренос сверился по всем коллекциям. Можно включать FACTORY_STORAGE=postgres.' : '\nПеренос не сверился. FACTORY_STORAGE=postgres включать нельзя.');
  return ok;
}

async function main(): Promise<void> {
  const mongo = new MongoFactoryStorage(config.mongoose.url);
  await mongo.connect();
  const db = createDb();
  let reports: Report[];
  try {
    reports = await migrate(db, mongo);
  } finally {
    await db.destroy();
    await mongo.disconnect();
  }
  if (!printReport(reports)) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
