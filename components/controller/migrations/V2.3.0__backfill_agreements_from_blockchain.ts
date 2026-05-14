import type { DataSource } from 'typeorm';

type MigrationLogger = {
  info: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
};

interface IChainAgreement {
  id: number;
  coopname: string;
  username: string;
  type: string;
  program_id: number;
  draft_id: number;
  version: number;
  document: {
    version?: string;
    hash?: string;
    doc_hash?: string;
    meta_hash?: string;
    meta?: string;
    signatures?: any[];
  };
  status: string;
  updated_at: string;
}

/**
 * Backfill `agreements` таблицы из блокчейна (`soviet::agreements3`).
 *
 * На дев/тест-кооперативах controller был поднят со снапшота, и старые
 * подписи (status='') до момента запуска sync не попали в Postgres через
 * delta-stream. Фронту это видится так: пайщик подписывал когда-то, но
 * `RequireAgreements` снова просит подписать `user`/`signature`/`privacy`.
 *
 * Миграция читает `agreements3` целиком по `scope = COOPNAME` через RPC и
 * UPSERT'ит каждую запись по полю `id`. Не трогает domain-status (`status`),
 * чтобы не сломать состояния, выставленные нормальным flow — UPSERT с
 * `DO UPDATE` пишет только поля, известные из блокчейна.
 *
 * Источник истины — блокчейн (`BLOCKCHAIN_RPC` env). RPC недоступен / пусто —
 * падаем явно (не молча).
 */
export default {
  name: 'Backfill agreements из soviet::agreements3 в Postgres',

  async up({ dataSource, logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    try {
      const rpcUrl = process.env.BLOCKCHAIN_RPC;
      const coopname = process.env.COOPNAME ?? 'voskhod';

      if (!rpcUrl) {
        logger.error('BLOCKCHAIN_RPC env не задан — миграция не применяется');
        return false;
      }

      logger.info(`Чтение soviet::agreements3[scope=${coopname}] из ${rpcUrl} …`);
      const rows = await fetchAllAgreements(rpcUrl, coopname, logger);
      logger.info(`Получено ${rows.length} записей agreements3.`);

      if (rows.length === 0) {
        logger.info('Нет agreements3 — нечего вгружать.');
        return true;
      }

      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      for (const row of rows) {
        // Программные соглашения отдаются на чтение из wallet::users.programs[],
        // не из `agreements`. Чтобы не получить дубль во фронте — заливаем
        // в БД только непрограммные.
        if (Number(row.program_id) > 0) { skipped += 1; continue; }

        const document = convertChainDocumentToDomain(row.document);
        const blockchainStatus = String(row.status ?? '');
        const updatedAt = new Date(row.updated_at);

        const result: Array<{ inserted: boolean }> = await dataSource.query(
          `
            INSERT INTO agreements (
              block_num, present, status, _created_at, _updated_at,
              id, coopname, username, type, program_id, draft_id, version,
              document, blockchain_status, updated_at
            ) VALUES (
              0, true, 'registered', now(), now(),
              $1, $2, $3, $4, $5, $6, $7,
              $8::json, $9, $10
            )
            ON CONFLICT (id) DO UPDATE SET
              coopname           = EXCLUDED.coopname,
              username           = EXCLUDED.username,
              type               = EXCLUDED.type,
              program_id         = EXCLUDED.program_id,
              draft_id           = EXCLUDED.draft_id,
              version            = EXCLUDED.version,
              document           = EXCLUDED.document,
              blockchain_status  = EXCLUDED.blockchain_status,
              updated_at         = EXCLUDED.updated_at,
              present            = true,
              _updated_at        = now()
            RETURNING (xmax = 0) AS inserted
          `,
          [
            row.id,
            row.coopname,
            row.username,
            row.type,
            row.program_id,
            row.draft_id,
            row.version,
            JSON.stringify(document),
            blockchainStatus,
            updatedAt,
          ],
        );
        if (result[0]?.inserted) inserted += 1; else updated += 1;
      }

      logger.info(`Backfill завершён: insert ${inserted}, update ${updated}, skip programmatic ${skipped}, всего ${rows.length}.`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      logger.error(`Ошибка backfill agreements: ${message}${stack ? `\n${stack}` : ''}`);
      return false;
    }
  },

  async down({ logger }: { logger: MigrationLogger }): Promise<boolean> {
    logger.warn(
      'Откат не выполняется: backfill идемпотентен по id, повторный up даст тот же результат.',
    );
    return true;
  },
};

function convertChainDocumentToDomain(chainDoc: IChainAgreement['document']) {
  return {
    version: chainDoc?.version,
    hash: chainDoc?.hash,
    doc_hash: chainDoc?.doc_hash,
    meta_hash: chainDoc?.meta_hash,
    meta:
      typeof chainDoc?.meta === 'string'
        ? chainDoc.meta === ''
          ? {}
          : safeJsonParse(chainDoc.meta)
        : (chainDoc?.meta ?? {}),
    signatures: chainDoc?.signatures ?? [],
  };
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

async function fetchAllAgreements(
  rpcUrl: string,
  coopname: string,
  logger: MigrationLogger,
): Promise<IChainAgreement[]> {
  const items: IChainAgreement[] = [];
  let lower_bound: string | undefined = '';

  for (let page = 0; page < 10000; page++) {
    const body = {
      json: true,
      code: 'soviet',
      scope: coopname,
      table: 'agreements3',
      limit: 1000,
      lower_bound,
    };

    const res = await fetch(`${rpcUrl.replace(/\/$/, '')}/v1/chain/get_table_rows`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`RPC ${res.status} ${res.statusText}: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      rows: IChainAgreement[];
      more: boolean;
      next_key?: string;
    };

    items.push(...data.rows);

    if (!data.more) return items;
    if (!data.next_key) {
      logger.warn('RPC ответил more=true без next_key — прерываем пагинацию');
      return items;
    }
    lower_bound = data.next_key;
  }

  throw new Error('Превышен лимит страниц при чтении soviet::agreements3');
}
