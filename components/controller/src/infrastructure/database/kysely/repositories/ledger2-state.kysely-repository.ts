import { Inject, Injectable } from '@nestjs/common';
import { Ledger2Contract } from 'cooptypes';
import { KYSELY, type Database } from '../kysely.tokens';
import { rawQuery } from '@coopenomics/extension-kit';
import type { Ledger2StatePort } from '~/domain/ledger2/ports/ledger2-state.port';
import type { Ledger2AccountDomainInterface } from '~/domain/ledger2/interfaces/ledger2-account.interface';
import type { Ledger2WalletDomainInterface } from '~/domain/ledger2/interfaces/ledger2-wallet.interface';
import type {
  Ledger2HistoryFilterDomainInterface,
  Ledger2HistoryResponseDomainInterface,
  Ledger2OperationDomainInterface,
} from '~/domain/ledger2/interfaces/ledger2-history.interface';
import type {
  Ledger2PostingDomainInterface,
  Ledger2PostingsFilterDomainInterface,
  Ledger2PostingsResponseDomainInterface,
} from '~/domain/ledger2/interfaces/ledger2-postings.interface';

const LEDGER2_CODE = Ledger2Contract.contractName.production;

/**
 * Сохранить symbol/precision исходного актива, но занулить amount.
 * Используется при present=false — запись удалена в чейне (`cleanup_l2_if_empty`
 * / `cleanup_l3_if_empty`), но в реестре оставляем строку с нулями, чтобы
 * пользователь мог раскрыть и посмотреть историю движений.
 */
function zeroAssetLike(s: unknown): string {
  const str = typeof s === 'string' ? s : '';
  const [num = '0.0000', symbol = 'RUB'] = str.trim().split(/\s+/);
  const dotIdx = num.indexOf('.');
  const decimals = dotIdx === -1 ? 4 : num.length - dotIdx - 1;
  return `${(0).toFixed(decimals)} ${symbol}`;
}

/** Место параметра в тексте запроса: значение уходит в параметры, в текст — его номер. */
type Bind = (value: unknown) => string;
/** Одно условие отбора: пусто, если поле фильтра не задано. */
type Clause<TFilter> = (filter: TFilter, bind: Bind) => string | null;

/** Собирает условия отбора и параметры: первые два параметра — контракт и кооператив. */
function buildClauses<TFilter extends { coopname: string }>(
  clauses: Clause<TFilter>[],
  filter: TFilter
): { conditions: string; params: unknown[] } {
  const params: unknown[] = [LEDGER2_CODE, filter.coopname];
  const bind: Bind = (value) => {
    params.push(value);
    return `$${params.length}`;
  };
  const found = clauses.map((clause) => clause(filter, bind)).filter((clause): clause is string => clause !== null);
  return { conditions: found.length ? 'AND ' + found.join(' AND ') : '', params };
}

/** Страница, предел и порядок выдачи из фильтра. */
function paging(filter: { page?: number; limit?: number; sortOrder?: string }) {
  const page = Math.max(1, filter.page ?? 1);
  const limit = Math.max(1, Math.min(500, filter.limit ?? 50));
  return { page, limit, offset: (page - 1) * limit, sortOrder: filter.sortOrder === 'ASC' ? 'ASC' : 'DESC' };
}

const text = (value: unknown, fallback = ''): string => String(value ?? fallback);
const textOrNull = (value: unknown): string | null => (value as string | null) ?? null;
const stringOrNull = (value: unknown): string | null => (value != null ? String(value) : null);
const numberOrNull = (value: unknown): number | null => (value != null ? Number(value) : null);
const dateOf = (value: unknown): Date => (value instanceof Date ? value : new Date(String(value)));
/** Сумма живой записи как есть; у удалённой в цепи — нули с тем же знаком валюты. */
const asset = (live: boolean, value: unknown): string => (live ? text(value, '0.0000 RUB') : zeroAssetLike(value));

type DeltaRow = { value: Record<string, unknown>; present: boolean };

function toAccount(row: DeltaRow): Ledger2AccountDomainInterface {
  const v = row.value ?? {};
  const live = row.present === true;
  return {
    id: parseInt(text(v.id, '0'), 10),
    name: text(v.name),
    balance: asset(live, v.balance),
    debitBalance: asset(live, v.debit_balance),
    creditBalance: asset(live, v.credit_balance),
    accountType: typeof v.account_type === 'number' ? v.account_type : Number(v.account_type ?? 0),
  };
}

function toWallet(row: DeltaRow): Ledger2WalletDomainInterface {
  const v = row.value ?? {};
  const live = row.present === true;
  return { id: text(v.id), name: text(v.name), available: asset(live, v.available), blocked: asset(live, v.blocked) };
}

function toOperation(r: Record<string, unknown>): Ledger2OperationDomainInterface {
  return {
    globalSequence: Number(r.globalSequence ?? 0),
    blockNum: Number(r.blockNum ?? 0),
    coopname: text(r.coopname),
    action: text(r.action),
    operationCode: textOrNull(r.operationCode),
    processHash: textOrNull(r.processHash),
    username: textOrNull(r.username),
    accountId: numberOrNull(r.accountId),
    walletFrom: stringOrNull(r.walletFrom),
    walletTo: stringOrNull(r.walletTo),
    quantity: textOrNull(r.quantity),
    memo: textOrNull(r.memo),
    parentApplyGlobalSequence: stringOrNull(r.parentApplyGlobalSequence),
    createdAt: dateOf(r.createdAt),
  };
}

function toPosting(r: Record<string, unknown>): Ledger2PostingDomainInterface {
  const debitSeq = stringOrNull(r.debitGlobalSequence);
  const creditSeq = stringOrNull(r.creditGlobalSequence);
  return {
    key: `${debitSeq ?? '_'}_${creditSeq ?? '_'}`,
    blockNum: Number(r.blockNum ?? 0),
    processHash: textOrNull(r.processHash),
    operationCode: textOrNull(r.operationCode),
    parentApplyGlobalSequence: stringOrNull(r.parentApplyGlobalSequence),
    debitGlobalSequence: debitSeq,
    debitAccountId: numberOrNull(r.debitAccountId),
    creditGlobalSequence: creditSeq,
    creditAccountId: numberOrNull(r.creditAccountId),
    quantity: textOrNull(r.quantity),
    memo: textOrNull(r.memo),
    username: textOrNull(r.username),
    createdAt: dateOf(r.createdAt),
  };
}

type HistoryClause = Clause<Ledger2HistoryFilterDomainInterface>;

// Бух.счёт (×1000): debit/credit имеют account_id в data — прямое сравнение.
// apply / revert сами account_id не несут, но мэтчатся через inline ребёнка
// (`debit`/`credit` с этим account_id и creator_action_ordinal=parent.action_ordinal).
const historyByAccount: HistoryClause = (filter, bind) => {
  if (filter.accountId === undefined) return null;
  const p = bind(String(filter.accountId));
  return `(
          (a.name IN ('debit', 'credit') AND (a.data ->> 'account_id')::text = ${p})
          OR (a.name IN ('apply', 'revert') AND EXISTS (
            SELECT 1 FROM blockchain_actions s
             WHERE s.account = a.account
               AND s.transaction_id = a.transaction_id
               AND s.creator_action_ordinal = a.action_ordinal
               AND s.name IN ('debit', 'credit')
               AND (s.data ->> 'account_id')::text = ${p}
          ))
        )`;
};

// walletop / walmove несут wallet_from/wallet_to в data — прямое сравнение.
// apply / revert — через inline ребёнка walletop с этим кошельком.
const historyByWallet: HistoryClause = (filter, bind) => {
  if (!filter.walletName) return null;
  const p = bind(filter.walletName);
  return `(
          (a.name IN ('walletop', 'walmove')
           AND ((a.data ->> 'wallet_from') = ${p} OR (a.data ->> 'wallet_to') = ${p}))
          OR (a.name IN ('apply', 'revert') AND EXISTS (
            SELECT 1 FROM blockchain_actions s
             WHERE s.account = a.account
               AND s.transaction_id = a.transaction_id
               AND s.creator_action_ordinal = a.action_ordinal
               AND s.name = 'walletop'
               AND ((s.data ->> 'wallet_from') = ${p} OR (s.data ->> 'wallet_to') = ${p})
          ))
        )`;
};

// № операции — точечная адресация одной operation-родительской записи
// (apply / walmove / revert). Возвращаем сам родитель + все его inline
// (walletop/debit/credit) через связь (transaction_id, creator_action_ordinal).
const historyByOperation: HistoryClause = (filter, bind) => {
  if (!filter.applyGlobalSequence) return null;
  const p = bind(filter.applyGlobalSequence);
  return `(
          (a.name IN ('apply', 'walmove', 'revert') AND a.global_sequence::bigint = ${p}::bigint)
          OR (a.name IN ('walletop', 'debit', 'credit') AND EXISTS (
            SELECT 1 FROM blockchain_actions ap
             WHERE ap.account = a.account
               AND ap.transaction_id = a.transaction_id
               AND ap.action_ordinal = a.creator_action_ordinal
               AND ap.global_sequence::bigint = ${p}::bigint
          ))
        )`;
};

// Раскрытие операции: inline-сибсы конкретного родителя по точечной связи
// (transaction_id, creator_action_ordinal=parent.action_ordinal). Имя
// родителя не ограничиваем — apply / walmove / revert одинаково
// оркестрируют inline-children.
const historyByParent: HistoryClause = (filter, bind) => {
  if (!filter.parentApplyGlobalSequence) return null;
  const p = bind(filter.parentApplyGlobalSequence);
  return `EXISTS (
          SELECT 1 FROM blockchain_actions ap
           WHERE ap.account = a.account
             AND ap.transaction_id = a.transaction_id
             AND ap.action_ordinal = a.creator_action_ordinal
             AND ap.global_sequence::bigint = ${p}::bigint
        )`;
};

const HISTORY_CLAUSES: HistoryClause[] = [
  historyByAccount,
  historyByWallet,
  (f, bind) => (f.processHash ? `LOWER(a.data ->> 'process_hash') = ${bind(f.processHash.toLowerCase())}` : null),
  historyByOperation,
  (f, bind) =>
    f.walletopGlobalSequence
      ? `(a.name = 'walletop' AND a.global_sequence::bigint = ${bind(f.walletopGlobalSequence)}::bigint)`
      : null,
  historyByParent,
  (f, bind) => (f.actionNames && f.actionNames.length > 0 ? `a.name = ANY(${bind(f.actionNames)})` : null),
  (f, bind) =>
    f.operationCodes && f.operationCodes.length > 0 ? `a.data ->> 'operation_code' = ANY(${bind(f.operationCodes)})` : null,
  (f, bind) => (f.username ? `a.data ->> 'username' = ${bind(f.username)}` : null),
  (f, bind) => (f.dateFrom ? `a.created_at >= ${bind(f.dateFrom)}` : null),
  (f, bind) => (f.dateTo ? `a.created_at <= ${bind(f.dateTo)}` : null),
];

const HISTORY_SELECT = `SELECT
         a.global_sequence                       AS "globalSequence",
         a.block_num                             AS "blockNum",
         (a.data ->> 'coopname')                 AS "coopname",
         a.name                                  AS "action",
         (a.data ->> 'operation_code')           AS "operationCode",
         LOWER(a.data ->> 'process_hash')        AS "processHash",
         (a.data ->> 'username')                 AS "username",
         CASE WHEN a.name IN ('debit', 'credit')
              THEN NULLIF(a.data ->> 'account_id', '')::bigint
              ELSE NULL
         END                                     AS "accountId",
         NULLIF(a.data ->> 'wallet_from', '')    AS "walletFrom",
         NULLIF(a.data ->> 'wallet_to', '')      AS "walletTo",
         COALESCE(
           NULLIF(a.data ->> 'quantity', ''),
           NULLIF(a.data ->> 'amount', '')
         )                                       AS "quantity",
         (a.data ->> 'memo')                     AS "memo",
         CASE WHEN a.name IN ('walletop', 'debit', 'credit')
              THEN (
                SELECT b.global_sequence
                  FROM blockchain_actions b
                 WHERE b.account = a.account
                   AND b.transaction_id = a.transaction_id
                   AND b.action_ordinal = a.creator_action_ordinal
                 LIMIT 1
              )
              ELSE NULL
         END                                     AS "parentApplyGlobalSequence",
         a.created_at                            AS "createdAt"
       FROM blockchain_actions a`;

type PostingClause = Clause<Ledger2PostingsFilterDomainInterface>;

// № операции — debit, чей родитель имеет это global_sequence. Связь
// по (transaction_id, creator_action_ordinal=parent.action_ordinal);
// имя родителя не ограничиваем — apply / revert одинаково ведут inline debit/credit.
const postingByOperation: PostingClause = (filter, bind) => {
  if (!filter.applyGlobalSequence) return null;
  const p = bind(filter.applyGlobalSequence);
  return `EXISTS (
          SELECT 1 FROM blockchain_actions ap
           WHERE ap.account = d.account
             AND ap.transaction_id = d.transaction_id
             AND ap.action_ordinal = d.creator_action_ordinal
             AND ap.global_sequence::bigint = ${p}::bigint
        )`;
};

// username debit/credit-actions не передают (см. ledger2.hpp). Берём из
// родителя (apply/revert) через точечный JOIN на (transaction_id, action_ordinal).
const postingByUsername: PostingClause = (filter, bind) => {
  if (!filter.username) return null;
  const p = bind(filter.username);
  return `EXISTS (
          SELECT 1 FROM blockchain_actions ap
           WHERE ap.account = d.account
             AND ap.transaction_id = d.transaction_id
             AND ap.action_ordinal = d.creator_action_ordinal
             AND ap.data ->> 'username' = ${p}
        )`;
};

// Попадание в debit ИЛИ credit ноге. Парный credit ищем по точному JOIN
// (transaction_id, creator_action_ordinal) — тот же оркестратор.
const postingByAccount: PostingClause = (filter, bind) => {
  if (filter.accountId === undefined) return null;
  const p = bind(String(filter.accountId));
  return `(
          (d.data ->> 'account_id')::text = ${p}
          OR EXISTS (
            SELECT 1 FROM blockchain_actions cc
             WHERE cc.account = d.account
               AND cc.transaction_id = d.transaction_id
               AND cc.creator_action_ordinal = d.creator_action_ordinal
               AND cc.name = 'credit'
               AND (cc.data ->> 'account_id')::text = ${p}
          )
        )`;
};

const POSTING_CLAUSES: PostingClause[] = [
  (f, bind) => (f.processHash ? `LOWER(d.data ->> 'process_hash') = ${bind(f.processHash.toLowerCase())}` : null),
  // № проводки = debit.global_sequence (unique). Парный credit подтянется через JOIN.
  (f, bind) => (f.debitGlobalSequence ? `d.global_sequence::bigint = ${bind(f.debitGlobalSequence)}::bigint` : null),
  postingByOperation,
  postingByUsername,
  (f, bind) => (f.dateFrom ? `d.created_at >= ${bind(f.dateFrom)}` : null),
  (f, bind) => (f.dateTo ? `d.created_at <= ${bind(f.dateTo)}` : null),
  postingByAccount,
];

// Пары debit↔credit — точечный LEFT JOIN на (transaction_id, creator_action_ordinal):
// оба inline вызваны из одного apply, у обоих creator_action_ordinal равен
// action_ordinal этого apply. Родительский apply подтягивается по
// (transaction_id, action_ordinal=d.creator_action_ordinal).
//
// ledger2::debit принимает поле `amount` (см. ledger2.hpp); в data других
// ledger2-actions `quantity` нет ни у кого (apply/walletop/walmove/revert
// тоже только `amount`).
const POSTING_SELECT = `SELECT
         d.global_sequence                       AS "debitGlobalSequence",
         d.block_num                             AS "blockNum",
         LOWER(d.data ->> 'process_hash')        AS "processHash",
         (d.data ->> 'memo')                     AS "memo",
         d.created_at                            AS "createdAt",
         NULLIF(d.data ->> 'account_id','')::bigint AS "debitAccountId",
         NULLIF(d.data ->> 'amount','')          AS "quantity",
         c.global_sequence                       AS "creditGlobalSequence",
         NULLIF(c.data ->> 'account_id','')::bigint AS "creditAccountId",
         ap.global_sequence                      AS "parentApplyGlobalSequence",
         (ap.data ->> 'operation_code')          AS "operationCode",
         (ap.data ->> 'username')                AS "username"
       FROM blockchain_actions d
       LEFT JOIN blockchain_actions c
         ON c.account = d.account
        AND c.transaction_id = d.transaction_id
        AND c.creator_action_ordinal = d.creator_action_ordinal
        AND c.name = 'credit'
       LEFT JOIN blockchain_actions ap
         ON ap.account = d.account
        AND ap.transaction_id = d.transaction_id
        AND ap.action_ordinal = d.creator_action_ordinal`;

const countOf = (rows: Array<{ cnt?: string }>): number => parseInt(rows[0]?.cnt ?? '0', 10);

/**
 * Чтение состояния ledger2 из Postgres-таблиц блокчейн-синка.
 *
 * Текущие балансы — `SELECT DISTINCT ON (primary_key) ... ORDER BY primary_key,
 * block_num DESC` по `blockchain_deltas`.
 *
 * История операций / реестр проводок — `blockchain_actions WHERE account='ledger2'`.
 * Связь apply-orchestrator ↔ inline walletop/debit/credit строится через явные
 * идентификаторы parser2: пара `(transaction_id, creator_action_ordinal)`
 * каждой inline-action указывает на `(transaction_id, action_ordinal)` её
 * родителя. Никаких эвристик «ближайший apply того же processHash» —
 * родительский apply находится точечным JOIN на этих полях.
 */
@Injectable()
export class Ledger2StateKyselyRepository implements Ledger2StatePort {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  // Берётся самая свежая запись на ключ вместе с признаком присутствия.
  // Удалённые в цепи записи не отбрасываются: строка остаётся в реестре с
  // обнулёнными суммами и именем из последнего снимка — у неё может быть
  // история движений, которую пользователь хочет раскрыть.
  async getAccounts(coopname: string): Promise<Ledger2AccountDomainInterface[]> {
    const rows = await rawQuery<DeltaRow>(
      this.db,
      `SELECT DISTINCT ON (primary_key) value, present
       FROM blockchain_deltas
       WHERE code = $1 AND "table" = '${Ledger2Contract.Tables.Accounts.tableName}' AND scope = $2
       ORDER BY primary_key, block_num DESC, created_at DESC`,
      [LEDGER2_CODE, coopname]
    );
    return rows.map(toAccount);
  }

  // Контракт удаляет запись кошелька при обнулении баланса; в журнале это
  // строка с present=false и последним снимком. Отбирать только present=true
  // НЕЛЬЗЯ: DISTINCT ON выбрал бы прежний снимок, и кошелёк светился бы со
  // старым балансом.
  async getWallets(coopname: string): Promise<Ledger2WalletDomainInterface[]> {
    const rows = await rawQuery<DeltaRow>(
      this.db,
      `SELECT DISTINCT ON (primary_key) value, present
       FROM blockchain_deltas
       WHERE code = $1 AND "table" = '${Ledger2Contract.Tables.Wallets.tableName}' AND scope = $2
       ORDER BY primary_key, block_num DESC, created_at DESC`,
      [LEDGER2_CODE, coopname]
    );
    return rows.map(toWallet);
  }

  async getHistory(filter: Ledger2HistoryFilterDomainInterface): Promise<Ledger2HistoryResponseDomainInterface> {
    const { page, limit, offset, sortOrder } = paging(filter);
    const { conditions, params } = buildClauses(HISTORY_CLAUSES, filter);
    const where = `
      a.account = $1
      AND a.data ->> 'coopname' = $2
      ${conditions}
    `;

    const totalCount = countOf(
      await rawQuery<{ cnt?: string }>(this.db, `SELECT COUNT(*) AS cnt FROM blockchain_actions a WHERE ${where}`, params)
    );
    const rows = await rawQuery<Record<string, unknown>>(
      this.db,
      `${HISTORY_SELECT}
       WHERE ${where}
       ORDER BY a.block_num ${sortOrder}, a.global_sequence ${sortOrder}
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    return { items: rows.map(toOperation), totalCount, totalPages: Math.max(1, Math.ceil(totalCount / limit)), currentPage: page };
  }

  async getPostings(filter: Ledger2PostingsFilterDomainInterface): Promise<Ledger2PostingsResponseDomainInterface> {
    const { page, limit, offset, sortOrder } = paging(filter);
    const { conditions, params } = buildClauses(POSTING_CLAUSES, filter);
    const debitWhere = `
      d.account = $1
      AND d.name = 'debit'
      AND d.data ->> 'coopname' = $2
      ${conditions}
    `;

    const totalCount = countOf(
      await rawQuery<{ cnt?: string }>(this.db, `SELECT COUNT(*) AS cnt FROM blockchain_actions d WHERE ${debitWhere}`, params)
    );
    const rows = await rawQuery<Record<string, unknown>>(
      this.db,
      `${POSTING_SELECT}
       WHERE ${debitWhere}
       ORDER BY d.block_num ${sortOrder}, d.global_sequence ${sortOrder}
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    return { items: rows.map(toPosting), totalCount, totalPages: Math.max(1, Math.ceil(totalCount / limit)), currentPage: page };
  }
}
