import type { DataSource } from 'typeorm';
import mongoose from 'mongoose';
import config from '~/config/config';

type MigrationLogger = {
  info: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
};

interface ChainDraft {
  id: string | number;
  registry_id: string | number;
  [key: string]: unknown;
}

interface ChainTranslation {
  id: string | number;
  draft_id: string | number;
  lang: string;
  [key: string]: unknown;
}

/** База, куда писал парсер прежней версии. */
const PARSER_DB = process.env.PARSER_MONGO_DB || '!parser';

/**
 * Блок, которым помечается состояние, взятое из цепи в обход истории.
 *
 * Единица, а не текущая высота: запрос за шаблоном идёт с условием «версия не
 * позже блока документа», и версия, помеченная сегодняшним блоком, не нашлась
 * бы ни для одного уже подписанного документа — сборка падала бы с «шаблон не
 * найден» на всём, что создано раньше. С первым блоком шаблон находится всегда;
 * платой за это будет текущая редакция текста там, где настоящей исторической
 * не сохранилось нигде.
 */
const BACKFILL_BLOCK = 1;

/**
 * Заполняет реестр шаблонов документов и переводов в базе узла.
 *
 * Зачем: узел перестаёт спрашивать шаблоны у обозревателя прежнего парсера и
 * читает их у себя. Перечитать цепь с начала нельзя — на живой сети это
 * десятки миллионов блоков.
 *
 * Источники по убыванию точности:
 *
 *   1. mongo прежнего парсера. Там лежит та же история изменений реестра,
 *      которую отдавал обозреватель, с настоящими номерами блоков — перенос
 *      сохраняет поведение сборки документов один в один.
 *   2. Текущее состояние цепи, помеченное первым блоком. Применяется, когда
 *      истории нет вовсе (свежая установка либо база парсера уже удалена).
 *      Регенерация при этом работает, но старый документ соберётся сегодняшней
 *      редакцией шаблона — в лог об этом пишется явно.
 *
 * Дальше историю ведёт синхронизация: каждая правка реестра в цепи добавляет
 * версию со своим номером блока.
 *
 * Идемпотентна: пара «шаблон + блок» уникальна, повторный прогон переписывает
 * те же строки, а на узле с уже наполненным реестром не делает ничего.
 */
export default {
  name: 'Seed draft_templates/draft_translations из истории парсера либо из цепи',

  async up({ dataSource, logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    try {
      await ensureRegistryTables(dataSource);

      const existing = await dataSource.query('SELECT count(*)::int AS c FROM draft_templates');
      if (Number(existing?.[0]?.c ?? 0) > 0) {
        logger.info('Реестр шаблонов уже наполнен — миграция пропущена');
        return true;
      }

      const fromHistory = await seedFromParserMongo(dataSource, logger);
      if (fromHistory > 0) {
        logger.info(`Реестр восстановлен из истории парсера: ${fromHistory} версий`);
        return true;
      }

      return await seedFromChain(dataSource, logger);
    } catch (error: any) {
      logger.error(`Ошибка заполнения реестра шаблонов: ${error?.message}`);
      return false;
    }
  },
};

/**
 * Создаёт таблицы реестра, если их ещё нет.
 *
 * Обычно схему заводит TypeORM при старте приложения, но миграции запускаются
 * сразу после подъёма контейнера — и на узле, где эти таблицы появляются
 * впервые, приложение может не успеть их создать. Тогда миграция падала на
 * `relation "draft_templates" does not exist`, а вместе с ней останавливался
 * весь деплой (так лёг прод-прогон 2026-08-16 на pgrzosdeyuwg). Полагаться на
 * порядок здесь нельзя: миграция обязана уметь работать на пустой базе.
 *
 * Имена ограничений и индексов взяты те же, что генерирует TypeORM, — иначе
 * при следующем старте он посчитал бы их недостающими и создал бы вторые.
 */
async function ensureRegistryTables(dataSource: DataSource): Promise<void> {
  // uuid_generate_v4() приходит из расширения uuid-ossp: TypeORM подключает его
  // сам при создании схемы, но здесь схему создаём мы.
  await dataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS draft_templates (
      id uuid NOT NULL DEFAULT uuid_generate_v4(),
      registry_id bigint NOT NULL,
      block_num bigint NOT NULL,
      value jsonb NOT NULL,
      present boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "PK_702989e2137730dad7bce950de8" PRIMARY KEY (id),
      CONSTRAINT "UQ_f0293727847fc362617ccd48920" UNIQUE (registry_id, block_num)
    )`);
  await dataSource.query(
    'CREATE INDEX IF NOT EXISTS "IDX_f0293727847fc362617ccd4892" ON draft_templates (registry_id, block_num)'
  );

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS draft_translations (
      id uuid NOT NULL DEFAULT uuid_generate_v4(),
      draft_id bigint NOT NULL,
      lang varchar(16) NOT NULL,
      block_num bigint NOT NULL,
      value jsonb NOT NULL,
      present boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "PK_7d5d15c0f49d269b63a9a275cfe" PRIMARY KEY (id),
      CONSTRAINT "UQ_b2c91a60be5f9567b9559fcda99" UNIQUE (draft_id, lang, block_num)
    )`);
  await dataSource.query(
    'CREATE INDEX IF NOT EXISTS "IDX_b2c91a60be5f9567b9559fcda9" ON draft_translations (draft_id, lang, block_num)'
  );
}

/**
 * Переносит историю реестра из mongo прежнего парсера — с её номерами блоков.
 * Возвращает количество перенесённых версий; ноль означает «истории нет».
 */
async function seedFromParserMongo(dataSource: DataSource, logger: MigrationLogger): Promise<number> {
  let mongo: mongoose.Connection | null = null;

  try {
    mongo = await mongoose.createConnection(config.mongoose.url).asPromise();
    const db = mongo.useDb(PARSER_DB).db;
    if (!db) return 0;

    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    if (!collections.some((c: { name: string }) => c.name === 'deltas')) {
      logger.info(`База ${PARSER_DB} без коллекции дельт — истории реестра нет`);
      return 0;
    }

    let migrated = 0;

    const templates = db.collection('deltas').find({ code: 'draft', table: 'drafts' });
    for await (const delta of templates) {
      const registryId = (delta as any)?.value?.registry_id;
      if (registryId === undefined || registryId === null) continue;

      await dataSource.query(
        `INSERT INTO draft_templates (registry_id, block_num, value, present)
         VALUES ($1::bigint, $2::bigint, $3::jsonb, $4::boolean)
         ON CONFLICT (registry_id, block_num) DO UPDATE SET value = EXCLUDED.value, present = EXCLUDED.present`,
        [
          String(registryId),
          Number((delta as any).block_num ?? BACKFILL_BLOCK),
          JSON.stringify((delta as any).value),
          (delta as any).present !== false,
        ]
      );
      migrated++;
    }

    const translations = db.collection('deltas').find({ code: 'draft', table: 'translations' });
    for await (const delta of translations) {
      const draftId = (delta as any)?.value?.draft_id;
      const lang = (delta as any)?.value?.lang;
      if (draftId === undefined || draftId === null || !lang) continue;

      await dataSource.query(
        `INSERT INTO draft_translations (draft_id, lang, block_num, value, present)
         VALUES ($1::bigint, $2::varchar, $3::bigint, $4::jsonb, $5::boolean)
         ON CONFLICT (draft_id, lang, block_num) DO UPDATE SET value = EXCLUDED.value, present = EXCLUDED.present`,
        [
          String(draftId),
          String(lang),
          Number((delta as any).block_num ?? BACKFILL_BLOCK),
          JSON.stringify((delta as any).value),
          (delta as any).present !== false,
        ]
      );
      migrated++;
    }

    return migrated;
  } catch (error: any) {
    // Недоступная база прежнего парсера — не повод валить деплой: ниже сработает
    // заполнение из цепи.
    logger.warn(`История реестра из ${PARSER_DB} недоступна (${error?.message}) — беру состояние из цепи`);
    return 0;
  } finally {
    if (mongo) await mongo.close();
  }
}

/** Резервный путь: актуальное состояние цепи, помеченное первым блоком. */
async function seedFromChain(dataSource: DataSource, logger: MigrationLogger): Promise<boolean> {
  const rpcUrl = process.env.BLOCKCHAIN_RPC;
  if (!rpcUrl) {
    logger.error('BLOCKCHAIN_RPC env не задан — реестр шаблонов не заполнить');
    return false;
  }

  logger.warn(
    'Истории реестра нет — беру текущее состояние цепи и помечаю первым блоком. ' +
      'Документы, подписанные ранее, соберутся сегодняшней редакцией шаблона.'
  );

  const drafts = await fetchTable<ChainDraft>(rpcUrl, 'draft', 'draft', 'drafts');
  const translations = await fetchTable<ChainTranslation>(rpcUrl, 'draft', 'draft', 'translations');
  logger.info(`Получено шаблонов: ${drafts.length}, переводов: ${translations.length}`);

  let templatesInserted = 0;
  for (const draft of drafts) {
    if (draft?.registry_id === undefined || draft?.registry_id === null) {
      // Шаблон без номера в реестре потребитель не найдёт — искать он будет
      // именно по нему. Пропускаем с явной записью, а не молча.
      logger.warn(`Шаблон id=${String(draft?.id)} без registry_id — пропущен`);
      continue;
    }

    await dataSource.query(
      `INSERT INTO draft_templates (registry_id, block_num, value, present)
       VALUES ($1::bigint, $2::bigint, $3::jsonb, true)
       ON CONFLICT (registry_id, block_num) DO UPDATE SET value = EXCLUDED.value, present = true`,
      [String(draft.registry_id), BACKFILL_BLOCK, JSON.stringify(draft)]
    );
    templatesInserted++;
  }

  let translationsInserted = 0;
  for (const translation of translations) {
    if (translation?.draft_id === undefined || translation?.draft_id === null || !translation?.lang) {
      logger.warn(`Перевод id=${String(translation?.id)} без draft_id/lang — пропущен`);
      continue;
    }

    await dataSource.query(
      `INSERT INTO draft_translations (draft_id, lang, block_num, value, present)
       VALUES ($1::bigint, $2::varchar, $3::bigint, $4::jsonb, true)
       ON CONFLICT (draft_id, lang, block_num) DO UPDATE SET value = EXCLUDED.value, present = true`,
      [String(translation.draft_id), String(translation.lang), BACKFILL_BLOCK, JSON.stringify(translation)]
    );
    translationsInserted++;
  }

  logger.info(`Реестр заполнен из цепи: шаблонов ${templatesInserted}, переводов ${translationsInserted}`);
  return true;
}

/** Постранично вычитывает таблицу цепи целиком. */
async function fetchTable<T>(rpcUrl: string, code: string, scope: string, table: string): Promise<T[]> {
  const items: T[] = [];
  let lower_bound: string | undefined = '';

  for (let page = 0; page < 10000; page++) {
    const res = await fetch(`${rpcUrl.replace(/\/$/, '')}/v1/chain/get_table_rows`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ json: true, code, scope, table, limit: 1000, lower_bound }),
    });

    if (!res.ok) throw new Error(`RPC get_table_rows ${res.status} ${res.statusText}: ${await res.text()}`);

    const data = (await res.json()) as { rows: T[]; more: boolean; next_key?: string };
    items.push(...data.rows);

    if (!data.more) return items;
    lower_bound = data.next_key;
  }

  return items;
}
