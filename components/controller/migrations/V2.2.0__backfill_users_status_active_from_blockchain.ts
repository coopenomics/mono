import type { DataSource } from 'typeorm';

type MigrationLogger = {
  info: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
};

interface IParticipantRow {
  username: string;
  status: string;
}

/**
 * Backfill `users.status = 'active'` для пайщиков, которые в блокчейне уже
 * приняты советом (soviet::participants[scope=coopname].status === 'accepted'),
 * но в моно-аккаунте контроллера до сих пор `4_Registered` — потому что до
 * введения `ParticipantStatusSyncService` транзишен `Registered → Active`
 * не делал никто, и `ActiveUserStatusGuard` отбрасывал их на write-операциях.
 *
 * Источник истины — блокчейн (`BLOCKCHAIN_RPC` env). Если RPC недоступен
 * или вернул пусто — миграция падает и не применяется (явно, без silent skip).
 */
export default {
  name: 'Backfill users.status=active по soviet::participants из блокчейна',

  async up({ dataSource, logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    try {
      const rpcUrl = process.env.BLOCKCHAIN_RPC;
      const coopname = process.env.COOPNAME ?? 'voskhod';

      if (!rpcUrl) {
        logger.error('BLOCKCHAIN_RPC env не задан — миграция не применяется');
        return false;
      }

      logger.info(`Чтение soviet::participants[scope=${coopname}] из ${rpcUrl} …`);

      const accepted = await fetchAcceptedParticipants(rpcUrl, coopname, logger);
      logger.info(`Найдено ${accepted.length} accepted-пайщиков в блокчейне.`);

      if (accepted.length === 0) {
        logger.info('Нет accepted-пайщиков — нечего обновлять.');
        return true;
      }

      const usernames = accepted.map((p) => p.username);
      const result: Array<{ username: string }> = await dataSource.query(
        `
          UPDATE users
             SET status     = 'active',
                 updated_at = now()
           WHERE username = ANY($1::text[])
             AND status   <> 'active'
        RETURNING username
        `,
        [usernames],
      );

      const updatedCount = result.length;
      const skipped = usernames.length - updatedCount;
      logger.info(
        `Обновлено ${updatedCount} users.status → active. Пропущено (уже active или нет в users): ${skipped}.`,
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      logger.error(`Ошибка backfill users.status=active: ${message}${stack ? `\n${stack}` : ''}`);
      return false;
    }
  },

  async down({ logger }: { logger: MigrationLogger }): Promise<boolean> {
    logger.warn(
      'Откат не выполняется: предыдущий статус (4_Registered и т.п.) не сохранён, ' +
        'и блокчейн всё равно содержит accepted — повторный up даст тот же результат.',
    );
    return true;
  },
};

async function fetchAcceptedParticipants(
  rpcUrl: string,
  coopname: string,
  logger: MigrationLogger,
): Promise<IParticipantRow[]> {
  const accepted: IParticipantRow[] = [];
  let lower_bound: string | undefined = '';

  for (let page = 0; page < 1000; page++) {
    const body = {
      json: true,
      code: 'soviet',
      scope: coopname,
      table: 'participants',
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

    const data = (await res.json()) as { rows: IParticipantRow[]; more: boolean; next_key?: string };

    for (const row of data.rows) {
      if (row.status === 'accepted' && row.username) {
        accepted.push({ username: row.username, status: row.status });
      }
    }

    if (!data.more) {
      return accepted;
    }
    if (!data.next_key) {
      logger.warn('RPC ответил more=true без next_key — прерываем пагинацию');
      return accepted;
    }
    lower_bound = data.next_key;
  }

  throw new Error('Превышен лимит страниц при чтении soviet::participants');
}
