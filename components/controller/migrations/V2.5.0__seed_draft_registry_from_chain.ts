import type { DataSource } from 'typeorm';

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

/**
 * Заполняет реестр шаблонов документов и переводов в базе узла.
 *
 * Зачем: узел перестаёт спрашивать шаблоны у обозревателя старого парсера и
 * читает их у себя. Взять историю неоткуда — перечитывать цепь с первого блока
 * на живой сети невозможно (десятки миллионов блоков), а обозреватель и сам
 * историей шаблонов не располагал: при первом запуске он точно так же
 * загружал из цепи текущее состояние и записывал его одним блоком. Поэтому
 * миграция повторяет ровно это поведение — забирает актуальные строки
 * `draft::drafts` и `draft::translations` и кладёт их версией текущего блока.
 *
 * Что это значит для документов: шаблон, действовавший в прошлом, восстановить
 * невозможно — его нет ни в одном из доступных источников. Документы, уже
 * подписанные, от этого не страдают: их содержимое и хэш зафиксированы в самом
 * подписанном документе, а не пересобираются из шаблона.
 *
 * Дальше историю ведёт синхронизация: каждая правка шаблона в цепи добавляет
 * новую версию со своим номером блока.
 *
 * Идемпотентна: пара «шаблон + блок» уникальна, повторный прогон переписывает
 * те же строки. На узле, где реестр уже наполнен синхронизацией, ничего не
 * делает.
 */
export default {
  name: 'Seed draft_templates/draft_translations из draft::drafts и draft::translations',

  async up({ dataSource, logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    const rpcUrl = process.env.BLOCKCHAIN_RPC;
    if (!rpcUrl) {
      logger.error('BLOCKCHAIN_RPC env не задан — реестр шаблонов не заполнить');
      return false;
    }

    try {
      const existing = await dataSource.query('SELECT count(*)::int AS c FROM draft_templates');
      if (Number(existing?.[0]?.c ?? 0) > 0) {
        logger.info('Реестр шаблонов уже наполнен — миграция пропущена');
        return true;
      }

      const headBlock = await fetchHeadBlock(rpcUrl);
      logger.info(`Чтение реестра шаблонов из ${rpcUrl}, версия будет записана блоком ${headBlock}`);

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
          [String(draft.registry_id), headBlock, JSON.stringify(draft)]
        );
        templatesInserted++;
      }

      let translationsInserted = 0;
      for (const translation of translations) {
        if (
          translation?.draft_id === undefined ||
          translation?.draft_id === null ||
          !translation?.lang
        ) {
          logger.warn(`Перевод id=${String(translation?.id)} без draft_id/lang — пропущен`);
          continue;
        }

        await dataSource.query(
          `INSERT INTO draft_translations (draft_id, lang, block_num, value, present)
           VALUES ($1::bigint, $2::varchar, $3::bigint, $4::jsonb, true)
           ON CONFLICT (draft_id, lang, block_num) DO UPDATE SET value = EXCLUDED.value, present = true`,
          [String(translation.draft_id), String(translation.lang), headBlock, JSON.stringify(translation)]
        );
        translationsInserted++;
      }

      logger.info(`Реестр заполнен: шаблонов ${templatesInserted}, переводов ${translationsInserted}`);
      return true;
    } catch (error: any) {
      logger.error(`Ошибка заполнения реестра шаблонов: ${error?.message}`);
      return false;
    }
  },
};

async function fetchHeadBlock(rpcUrl: string): Promise<number> {
  const res = await fetch(`${rpcUrl.replace(/\/$/, '')}/v1/chain/get_info`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error(`RPC get_info ${res.status} ${res.statusText}`);
  const info = (await res.json()) as { head_block_num: number };
  return Number(info.head_block_num);
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
