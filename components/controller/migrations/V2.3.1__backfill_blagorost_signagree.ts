import type { DataSource } from 'typeorm';
import type { BlockchainService } from '~/infrastructure/blockchain/blockchain.service';
import type { VaultDomainService } from '~/domain/vault/services/vault-domain.service';
import { WalletContract } from 'cooptypes';
import config from '~/config/config';

type MigrationLogger = {
  info: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
};

interface IDocSignature {
  signed_at?: string;
  signer?: string;
}

interface IBlagorostDoc {
  hash?: string;
  doc_hash?: string;
  version?: string;
  signatures?: IDocSignature[];
}

interface IRegcontribData {
  coopname: string;
  username: string;
  blagorost_agreement?: IBlagorostDoc | null;
  generator_agreement?: IBlagorostDoc | null;
}

interface IProgramAgreementRow {
  program_id: number | string;
}

interface IWalletUserRow {
  username: string;
  programs: IProgramAgreementRow[];
}

interface ISovietProgramRow {
  id: number | string;
  draft_id: number | string;
}

interface IDraftRow {
  id: number | string;
  version: number | string;
}

const BLAGOROST_PROGRAM_ID = 4;
const GENERATOR_PROGRAM_ID = 3;
const ZERO_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Backfill `wallet::users.programs[]` для исторических контрибуторов: их
 * `regcontrib` приехал ДО того, как capital научился делать inline
 * `wallet::signagree`. Подписанные документы лежат в `blockchain_actions.data`
 * как audit trail, но в state контракта `wallet::users` их не оказалось —
 * фронт ругается «У пайщика нет кошелька в программе Благорост».
 *
 * Поток:
 *   1. SELECT всех capital::regcontrib из локального controller-Postgres.
 *   2. Группировка по (coopname, username) — последний `regcontrib` выигрывает
 *      (после importcontrib обычно ещё один regcontrib).
 *   3. Для каждой пары через RPC проверяем `wallet::users.programs[]`.
 *   4. Если program_id=4 (Благорост) ещё нет и `data.blagorost_agreement`
 *      валидный — пушим `wallet::migrate3` от `coopname@active` с реальным
 *      `doc_hash` и `signed_at = signatures[0].signed_at`. То же для
 *      program_id=3 (Генератор).
 *
 * Auth: `coopname@active` — после расширения `wallet::migrate3` (контракт
 *       принимает либо `wallet@active`, либо `coopname@active`).
 *
 * Идемпотентно: повторный запуск увидит уже подписанных и пропустит их.
 *
 * Активна до 2027-05-01: к этому моменту все исторические orphan'ы должны
 * быть закрыты, а новые регистрации идут через корректный `regcontrib`.
 */
export default {
  name: 'Backfill wallet::users.programs[] из capital::regcontrib (Благорост/Генератор)',
  validUntil: new Date('2027-05-01T00:00:00Z'),

  async up({
    dataSource,
    blockchain,
    vault,
    logger,
  }: {
    dataSource: DataSource;
    blockchain: BlockchainService;
    vault: VaultDomainService;
    logger: MigrationLogger;
  }): Promise<boolean> {
    try {
      const rpcUrl = config.blockchain.url;
      if (!rpcUrl) {
        logger.error('BLOCKCHAIN_RPC не задан — миграция не применяется');
        return false;
      }

      const rawRows = (await dataSource.query(
        `SELECT data
           FROM blockchain_actions
          WHERE account = 'capital' AND name = 'regcontrib'
          ORDER BY block_num ASC`,
      )) as Array<{ data: IRegcontribData }>;

      logger.info(`regcontrib actions найдено: ${rawRows.length}`);
      if (rawRows.length === 0) {
        logger.info('Нет regcontrib в локальной БД — нечего бэкфиллить.');
        return true;
      }

      const latestByPair = new Map<string, IRegcontribData>();
      for (const r of rawRows) {
        latestByPair.set(`${r.data.coopname}/${r.data.username}`, r.data);
      }
      logger.info(`Уникальных (coopname, username): ${latestByPair.size}`);

      const coopnames = Array.from(new Set([...latestByPair.values()].map((d) => d.coopname)));
      const draftVersions = await fetchDraftVersions(rpcUrl, logger);

      let pushed = 0;
      let skipped = 0;
      let missing = 0;
      let failed = 0;

      for (const coopname of coopnames) {
        const wif = await vault.getWif(coopname);
        if (!wif) {
          logger.warn(`WIF для ${coopname} не найден в vault — пропускаю кооператив`);
          continue;
        }
        blockchain.initialize(coopname, wif);

        const usersPrograms = await fetchWalletUserPrograms(rpcUrl, coopname, logger);
        const programs = await fetchSovietPrograms(rpcUrl, coopname, logger);

        for (const [pairKey, regData] of latestByPair) {
          if (regData.coopname !== coopname) continue;

          const targets: Array<{ programId: number; doc: IBlagorostDoc }> = [];
          if (isValidAgreement(regData.blagorost_agreement)) {
            targets.push({ programId: BLAGOROST_PROGRAM_ID, doc: regData.blagorost_agreement! });
          }
          if (isValidAgreement(regData.generator_agreement)) {
            targets.push({ programId: GENERATOR_PROGRAM_ID, doc: regData.generator_agreement! });
          }
          if (targets.length === 0) continue;

          const already = usersPrograms.get(regData.username) ?? new Set<number>();

          for (const { programId, doc } of targets) {
            if (already.has(programId)) {
              skipped += 1;
              continue;
            }
            const program = programs.get(programId);
            if (!program) {
              missing += 1;
              logger.warn(
                `${pairKey}: программа program_id=${programId} не найдена в soviet::programs — skip`,
              );
              continue;
            }
            const draftId = Number(program.draft_id);
            const version = draftId > 0 ? draftVersions.get(draftId) ?? 0 : 0;
            const docHash = (doc.hash ?? doc.doc_hash) as string;
            const signedAt =
              doc.signatures?.[0]?.signed_at ?? new Date().toISOString().replace(/\.\d+Z$/, '');

            const actionData: WalletContract.Actions.Migrate3.IMigrate3 = {
              coopname: regData.coopname,
              username: regData.username,
              program_id: programId,
              doc_hash: docHash,
              version,
              draft_id: draftId,
              signed_at: signedAt,
            };

            try {
              await blockchain.transact({
                account: WalletContract.contractName.production,
                name: WalletContract.Actions.Migrate3.actionName,
                authorization: [{ actor: coopname, permission: 'active' }],
                data: actionData,
              });
              pushed += 1;
              logger.info(
                `migrate3 OK ${pairKey} program_id=${programId} draft_id=${draftId} ` +
                  `ver=${version} hash=${docHash.slice(0, 12)}…`,
              );
            } catch (err) {
              failed += 1;
              const msg = err instanceof Error ? err.message : String(err);
              logger.error(`migrate3 FAIL ${pairKey} program_id=${programId}: ${msg}`);
            }
          }
        }
      }

      logger.info(
        `Backfill завершён: push ${pushed}, уже подписаны ${skipped}, программа не найдена ${missing}, ` +
          `ошибок ${failed}.`,
      );
      return failed === 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      logger.error(`Ошибка backfill blagorost signagree: ${message}${stack ? `\n${stack}` : ''}`);
      return false;
    }
  },

  async down({ logger }: { logger: MigrationLogger }): Promise<boolean> {
    logger.warn(
      'Откат не выполняется: backfill идемпотентен и работает только для orphan-программ. ' +
        'Удаление записей wallet::users делается вручную через wallet::revokeagree.',
    );
    return true;
  },
};

function isValidAgreement(doc: IBlagorostDoc | null | undefined): doc is IBlagorostDoc {
  if (!doc) return false;
  const hash = doc.hash ?? doc.doc_hash;
  return typeof hash === 'string' && hash.length === 64 && hash !== ZERO_HASH;
}

async function rpcGetTableRows<T>(
  rpcUrl: string,
  payload: Record<string, unknown>,
  logger: MigrationLogger,
): Promise<T[]> {
  const items: T[] = [];
  let lower_bound: string | undefined = '';

  for (let page = 0; page < 10_000; page++) {
    const res = await fetch(`${rpcUrl.replace(/\/$/, '')}/v1/chain/get_table_rows`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ json: true, limit: 1000, lower_bound, ...payload }),
    });
    if (!res.ok) throw new Error(`RPC ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { rows: T[]; more: boolean; next_key?: string };
    items.push(...data.rows);
    if (!data.more) return items;
    if (!data.next_key) {
      logger.warn('RPC ответил more=true без next_key — прерываем пагинацию');
      return items;
    }
    lower_bound = data.next_key;
  }
  throw new Error('Превышен лимит страниц get_table_rows');
}

async function fetchWalletUserPrograms(
  rpcUrl: string,
  coopname: string,
  logger: MigrationLogger,
): Promise<Map<string, Set<number>>> {
  const rows = await rpcGetTableRows<IWalletUserRow>(
    rpcUrl,
    { code: 'wallet', scope: coopname, table: 'users' },
    logger,
  );
  const out = new Map<string, Set<number>>();
  for (const r of rows) {
    out.set(r.username, new Set(r.programs.map((p) => Number(p.program_id))));
  }
  return out;
}

async function fetchSovietPrograms(
  rpcUrl: string,
  coopname: string,
  logger: MigrationLogger,
): Promise<Map<number, ISovietProgramRow>> {
  const rows = await rpcGetTableRows<ISovietProgramRow>(
    rpcUrl,
    { code: 'soviet', scope: coopname, table: 'programs' },
    logger,
  );
  const out = new Map<number, ISovietProgramRow>();
  for (const r of rows) out.set(Number(r.id), r);
  return out;
}

async function fetchDraftVersions(
  rpcUrl: string,
  logger: MigrationLogger,
): Promise<Map<number, number>> {
  const rows = await rpcGetTableRows<IDraftRow>(
    rpcUrl,
    { code: 'draft', scope: 'draft', table: 'drafts' },
    logger,
  );
  const out = new Map<number, number>();
  for (const r of rows) out.set(Number(r.id), Number(r.version));
  return out;
}
