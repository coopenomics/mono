import type { DataSource } from 'typeorm';
import mongoose from 'mongoose';
import config from '~/config/config';

type MigrationLogger = {
  info: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
};

/** База, куда писал парсер прежней версии. */
const PARSER_DB = process.env.PARSER_MONGO_DB || '!parser';

const CODE = 'registrator';
const SCOPE = 'registrator';
const TABLE = 'coops';

/**
 * Блок, которым помечается строка, взятая из цепи в обход истории. Первый — по
 * той же причине, что и в V2.5.0: реквизиты, помеченные сегодняшним блоком, не
 * нашлись бы ни для одного ранее подписанного документа.
 */
const BACKFILL_BLOCK = 1;

/**
 * Кладёт в журнал дельт строку своего кооператива из реестра сети
 * (`registrator::coops`).
 *
 * Зачем: реквизиты кооператива входят в каждый документ, и сборка начинается
 * именно с них. Раньше их отдавал обозреватель прежнего парсера, теперь узел
 * читает журнал дельт у себя — а этой строки в журнале нет и быть не могло:
 * реестр кооперативов лежит в скоупе контракта и называет владельца полем
 * `username`, поэтому отбор дельт «своё / чужое» отбрасывал её всегда. Правило
 * отбора исправлено (delta-ownership), но само по себе оно наполнит журнал
 * только при следующем изменении строки в цепи, а меняется она редко — узел
 * остался бы без реквизитов на неопределённый срок, и генерация документов
 * падала бы с «информация о кооперативе не обнаружена».
 *
 * Источники по убыванию точности — те же, что в V2.5.0: история из mongo
 * прежнего парсера, а при её отсутствии текущее состояние цепи, помеченное
 * первым блоком.
 *
 * Идемпотентна: строка вставляется только если такой ещё нет.
 */
export default {
  name: 'Backfill registrator::coops delta для своего кооператива',

  async up({ dataSource, logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    const coopname = config.coopname;

    try {
      const existing = await dataSource.query(
        `SELECT count(*)::int AS c FROM blockchain_deltas WHERE code = $1 AND "table" = $2`,
        [CODE, TABLE]
      );
      if (Number(existing?.[0]?.c ?? 0) > 0) {
        logger.info('Реквизиты кооператива уже есть в журнале дельт — миграция пропущена');
        return true;
      }

      const fromHistory = await seedFromParserMongo(dataSource, coopname, logger);
      if (fromHistory > 0) {
        logger.info(`Реквизиты кооператива восстановлены из истории парсера: ${fromHistory} дельт`);
        return true;
      }

      return await seedFromChain(dataSource, coopname, logger);
    } catch (error: any) {
      logger.error(`Ошибка заполнения реквизитов кооператива: ${error?.message}`);
      return false;
    }
  },
};

/** История изменений строки своего кооператива — с настоящими номерами блоков. */
async function seedFromParserMongo(
  dataSource: DataSource,
  coopname: string,
  logger: MigrationLogger
): Promise<number> {
  let mongo: mongoose.Connection | null = null;

  try {
    mongo = await mongoose.createConnection(config.mongoose.url).asPromise();
    const db = mongo.useDb(PARSER_DB).db;
    if (!db) return 0;

    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    if (!collections.some((c: { name: string }) => c.name === 'deltas')) {
      logger.info(`База ${PARSER_DB} без коллекции дельт — истории реквизитов нет`);
      return 0;
    }

    const cursor = db
      .collection('deltas')
      .find({ code: CODE, table: TABLE, 'value.username': coopname })
      .sort({ block_num: 1 });

    let inserted = 0;
    for await (const delta of cursor) {
      const d = delta as any;
      inserted += await insertDelta(dataSource, {
        chain_id: d.chain_id ?? config.blockchain.id ?? '',
        block_num: Number(d.block_num ?? BACKFILL_BLOCK),
        block_id: d.block_id ?? '',
        present: d.present !== false,
        primary_key: String(d.primary_key ?? nameToUint64(coopname)),
        value: d.value ?? null,
      });
    }

    return inserted;
  } catch (error: any) {
    logger.warn(`История реквизитов из ${PARSER_DB} недоступна (${error?.message}) — беру состояние из цепи`);
    return 0;
  } finally {
    if (mongo) await mongo.close();
  }
}

/** Резервный путь: текущая строка реестра, помеченная первым блоком. */
async function seedFromChain(dataSource: DataSource, coopname: string, logger: MigrationLogger): Promise<boolean> {
  const rpcUrl = process.env.BLOCKCHAIN_RPC;
  if (!rpcUrl) {
    logger.error('BLOCKCHAIN_RPC env не задан — реквизиты кооператива не заполнить');
    return false;
  }

  const response = await fetch(`${rpcUrl.replace(/\/$/, '')}/v1/chain/get_table_rows`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ json: true, code: CODE, scope: SCOPE, table: TABLE, limit: 1000 }),
  });

  if (!response.ok) {
    logger.error(`Цепь ответила ${response.status} на get_table_rows ${TABLE}`);
    return false;
  }

  const data = (await response.json()) as { rows: Array<{ username?: string }> };
  const row = data.rows.find((r) => r.username === coopname);

  if (!row) {
    // Узел без своей строки в реестре сети — состояние, при котором документы
    // не собираются в принципе. Молчать об этом нельзя, но и валить деплой не
    // за что: кооператив может быть ещё не зарегистрирован.
    logger.warn(`Кооператив ${coopname} не найден в реестре сети — реквизиты остались незаполненными`);
    return true;
  }

  logger.warn(
    'Истории реквизитов нет — беру текущее состояние цепи и помечаю первым блоком. ' +
      'Документы, подписанные ранее, соберутся сегодняшними реквизитами кооператива.'
  );

  await insertDelta(dataSource, {
    chain_id: config.blockchain.id ?? '',
    block_num: BACKFILL_BLOCK,
    block_id: '',
    present: true,
    primary_key: nameToUint64(coopname),
    value: row,
  });

  logger.info(`Реквизиты кооператива ${coopname} занесены в журнал дельт`);
  return true;
}

/** Возвращает 1, если строка действительно вставлена. */
async function insertDelta(
  dataSource: DataSource,
  delta: {
    chain_id: string;
    block_num: number;
    block_id: string;
    present: boolean;
    primary_key: string;
    value: unknown;
  }
): Promise<number> {
  const value = delta.value === undefined || delta.value === null ? null : JSON.stringify(delta.value);

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
    [delta.chain_id, delta.block_num, delta.block_id, delta.present, CODE, SCOPE, TABLE, delta.primary_key, value]
  );

  return result.length > 0 ? 1 : 0;
}

/**
 * Первичный ключ строки в таблице цепи — имя аккаунта, упакованное в uint64
 * (кодировка `name` в Antelope). Тот же ключ приходит в дельтах от индексера,
 * поэтому вычисляем его так же: иначе бэкфилл и живая дельта выглядели бы как
 * две разные строки таблицы.
 */
function nameToUint64(name: string): string {
  let value = 0n;

  for (let i = 0; i <= 12; i++) {
    let c = 0n;
    if (i < name.length) c = BigInt(charToSymbol(name[i]));

    if (i < 12) {
      c &= 0x1fn;
      c <<= BigInt(64 - 5 * (i + 1));
    } else {
      c &= 0x0fn;
    }

    value |= c;
  }

  return value.toString();
}

function charToSymbol(c: string): number {
  if (c >= 'a' && c <= 'z') return c.charCodeAt(0) - 'a'.charCodeAt(0) + 6;
  if (c >= '1' && c <= '5') return c.charCodeAt(0) - '1'.charCodeAt(0) + 1;
  return 0;
}
