import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ledger2Contract } from 'cooptypes';
import { DeltaEntity } from '../entities/delta.entity';
import { ActionEntity } from '../entities/action.entity';
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
export class TypeOrmLedger2StateRepository implements Ledger2StatePort {
  constructor(
    @InjectRepository(DeltaEntity) private readonly deltaRepo: Repository<DeltaEntity>,
    @InjectRepository(ActionEntity) private readonly actionRepo: Repository<ActionEntity>,
  ) {}

  async getAccounts(coopname: string): Promise<Ledger2AccountDomainInterface[]> {
    // Берём самую свежую row на ключ (DISTINCT ON по block_num DESC) вместе
    // с present-флагом. Удалённые в чейне записи (present=false) **не**
    // отбрасываем: оставляем строку в реестре с обнулёнными суммами и
    // именем/id из last_snapshot — у такой записи может быть история
    // (debit/credit), которую пользователь хочет раскрыть.
    const rows = await this.deltaRepo.manager.query(
      `SELECT DISTINCT ON (primary_key) value, present
       FROM blockchain_deltas
       WHERE code = $1 AND "table" = '${Ledger2Contract.Tables.Accounts.tableName}' AND scope = $2
       ORDER BY primary_key, block_num DESC, created_at DESC`,
      [LEDGER2_CODE, coopname],
    );
    return (rows as Array<{ value: Record<string, unknown>; present: boolean }>).map((row) => {
      const v = row.value ?? {};
      const live = row.present === true;
      return {
        id: parseInt(String(v.id ?? 0), 10),
        name: String(v.name ?? ''),
        balance: live ? String(v.balance ?? '0.0000 RUB') : zeroAssetLike(v.balance),
        debitBalance: live ? String(v.debit_balance ?? '0.0000 RUB') : zeroAssetLike(v.debit_balance),
        creditBalance: live ? String(v.credit_balance ?? '0.0000 RUB') : zeroAssetLike(v.credit_balance),
        accountType: typeof v.account_type === 'number' ? v.account_type : Number(v.account_type ?? 0),
      };
    });
  }

  async getWallets(coopname: string): Promise<Ledger2WalletDomainInterface[]> {
    // Контракт удаляет L2-запись (`cleanup_l2_if_empty`) при обнулении баланса.
    // Parser2 кладёт delete как row с present=false и value=last_snapshot.
    // В реестре кошельков такую запись **оставляем** (с available=0/blocked=0
    // и id/name из snapshot), чтобы пользователь мог раскрыть и посмотреть
    // историю движений по кошельку. WHERE present=true тут НЕЛЬЗЯ: фильтр
    // выкинет delete-row, и DISTINCT ON выберет предыдущую present=true со
    // старым снимком — кошелёк продолжал бы светиться с прежним балансом.
    const rows = await this.deltaRepo.manager.query(
      `SELECT DISTINCT ON (primary_key) value, present
       FROM blockchain_deltas
       WHERE code = $1 AND "table" = '${Ledger2Contract.Tables.Wallets.tableName}' AND scope = $2
       ORDER BY primary_key, block_num DESC, created_at DESC`,
      [LEDGER2_CODE, coopname],
    );
    return (rows as Array<{ value: Record<string, unknown>; present: boolean }>).map((row) => {
      const v = row.value ?? {};
      const live = row.present === true;
      return {
        id: String(v.id ?? ''),
        name: String(v.name ?? ''),
        available: live ? String(v.available ?? '0.0000 RUB') : zeroAssetLike(v.available),
        blocked: live ? String(v.blocked ?? '0.0000 RUB') : zeroAssetLike(v.blocked),
      };
    });
  }

  async getHistory(
    filter: Ledger2HistoryFilterDomainInterface,
  ): Promise<Ledger2HistoryResponseDomainInterface> {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.max(1, Math.min(500, filter.limit ?? 50));
    const offset = (page - 1) * limit;
    const sortOrder = filter.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const params: unknown[] = [LEDGER2_CODE, filter.coopname];
    let pIdx = 3;
    const clauses: string[] = [];

    if (filter.accountId !== undefined) {
      // Бух.счёт (×1000): debit/credit имеют account_id в data — прямое сравнение.
      // apply / revert сами account_id не несут, но мэтчатся через inline ребёнка
      // (`debit`/`credit` с этим account_id и creator_action_ordinal=parent.action_ordinal).
      clauses.push(
        `(
          (a.name IN ('debit', 'credit') AND (a.data ->> 'account_id')::text = $${pIdx})
          OR (a.name IN ('apply', 'revert') AND EXISTS (
            SELECT 1 FROM blockchain_actions s
             WHERE s.account = a.account
               AND s.transaction_id = a.transaction_id
               AND s.creator_action_ordinal = a.action_ordinal
               AND s.name IN ('debit', 'credit')
               AND (s.data ->> 'account_id')::text = $${pIdx}
          ))
        )`,
      );
      params.push(String(filter.accountId));
      pIdx += 1;
    }
    if (filter.walletName) {
      // walletop / walmove несут wallet_from/wallet_to в data — прямое сравнение.
      // apply / revert — через inline ребёнка walletop с этим кошельком.
      clauses.push(
        `(
          (a.name IN ('walletop', 'walmove')
           AND ((a.data ->> 'wallet_from') = $${pIdx} OR (a.data ->> 'wallet_to') = $${pIdx}))
          OR (a.name IN ('apply', 'revert') AND EXISTS (
            SELECT 1 FROM blockchain_actions s
             WHERE s.account = a.account
               AND s.transaction_id = a.transaction_id
               AND s.creator_action_ordinal = a.action_ordinal
               AND s.name = 'walletop'
               AND ((s.data ->> 'wallet_from') = $${pIdx} OR (s.data ->> 'wallet_to') = $${pIdx})
          ))
        )`,
      );
      params.push(filter.walletName);
      pIdx += 1;
    }
    if (filter.processHash) {
      clauses.push(`LOWER(a.data ->> 'process_hash') = $${pIdx}`);
      params.push(filter.processHash.toLowerCase());
      pIdx += 1;
    }
    if (filter.applyGlobalSequence) {
      // № операции — точечная адресация одной operation-родительской записи
      // (apply / walmove / revert). Возвращаем сам родитель + все его inline
      // (walletop/debit/credit) через связь (transaction_id, creator_action_ordinal).
      clauses.push(
        `(
          (a.name IN ('apply', 'walmove', 'revert') AND a.global_sequence::bigint = $${pIdx}::bigint)
          OR (a.name IN ('walletop', 'debit', 'credit') AND EXISTS (
            SELECT 1 FROM blockchain_actions ap
             WHERE ap.account = a.account
               AND ap.transaction_id = a.transaction_id
               AND ap.action_ordinal = a.creator_action_ordinal
               AND ap.global_sequence::bigint = $${pIdx}::bigint
          ))
        )`,
      );
      params.push(filter.applyGlobalSequence);
      pIdx += 1;
    }
    if (filter.walletopGlobalSequence) {
      clauses.push(
        `(a.name = 'walletop' AND a.global_sequence::bigint = $${pIdx}::bigint)`,
      );
      params.push(filter.walletopGlobalSequence);
      pIdx += 1;
    }
    if (filter.parentApplyGlobalSequence) {
      // Раскрытие операции: inline-сибсы конкретного родителя по точечной связи
      // (transaction_id, creator_action_ordinal=parent.action_ordinal). Имя
      // родителя не ограничиваем — apply / walmove / revert одинаково
      // оркестрируют inline-children.
      clauses.push(
        `EXISTS (
          SELECT 1 FROM blockchain_actions ap
           WHERE ap.account = a.account
             AND ap.transaction_id = a.transaction_id
             AND ap.action_ordinal = a.creator_action_ordinal
             AND ap.global_sequence::bigint = $${pIdx}::bigint
        )`,
      );
      params.push(filter.parentApplyGlobalSequence);
      pIdx += 1;
    }
    if (filter.actionNames && filter.actionNames.length > 0) {
      clauses.push(`a.name = ANY($${pIdx})`);
      params.push(filter.actionNames);
      pIdx += 1;
    }
    if (filter.operationCodes && filter.operationCodes.length > 0) {
      clauses.push(`a.data ->> 'operation_code' = ANY($${pIdx})`);
      params.push(filter.operationCodes);
      pIdx += 1;
    }
    if (filter.username) {
      clauses.push(`a.data ->> 'username' = $${pIdx}`);
      params.push(filter.username);
      pIdx += 1;
    }
    if (filter.dateFrom) {
      clauses.push(`a.created_at >= $${pIdx}`);
      params.push(filter.dateFrom);
      pIdx += 1;
    }
    if (filter.dateTo) {
      clauses.push(`a.created_at <= $${pIdx}`);
      params.push(filter.dateTo);
      pIdx += 1;
    }

    const where = `
      a.account = $1
      AND a.data ->> 'coopname' = $2
      ${clauses.length ? 'AND ' + clauses.join(' AND ') : ''}
    `;

    const countRow = await this.actionRepo.manager.query(
      `SELECT COUNT(*) AS cnt FROM blockchain_actions a WHERE ${where}`,
      params,
    );
    const totalCount = parseInt(countRow[0]?.cnt ?? '0', 10);
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    const rows = await this.actionRepo.manager.query(
      `SELECT
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
       FROM blockchain_actions a
       WHERE ${where}
       ORDER BY a.block_num ${sortOrder}, a.global_sequence ${sortOrder}
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    );

    const items: Ledger2OperationDomainInterface[] = (
      rows as Array<Record<string, unknown>>
    ).map((r) => ({
      globalSequence: Number(r.globalSequence ?? 0),
      blockNum: Number(r.blockNum ?? 0),
      coopname: String(r.coopname ?? ''),
      action: String(r.action ?? ''),
      operationCode: (r.operationCode as string | null) ?? null,
      processHash: (r.processHash as string | null) ?? null,
      username: (r.username as string | null) ?? null,
      accountId: r.accountId !== null && r.accountId !== undefined ? Number(r.accountId) : null,
      walletFrom: r.walletFrom != null ? String(r.walletFrom) : null,
      walletTo: r.walletTo != null ? String(r.walletTo) : null,
      quantity: (r.quantity as string | null) ?? null,
      memo: (r.memo as string | null) ?? null,
      parentApplyGlobalSequence:
        r.parentApplyGlobalSequence != null ? String(r.parentApplyGlobalSequence) : null,
      createdAt: r.createdAt instanceof Date ? r.createdAt : new Date(String(r.createdAt)),
    }));

    return { items, totalCount, totalPages, currentPage: page };
  }

  async getPostings(
    filter: Ledger2PostingsFilterDomainInterface,
  ): Promise<Ledger2PostingsResponseDomainInterface> {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.max(1, Math.min(500, filter.limit ?? 50));
    const offset = (page - 1) * limit;
    const sortOrder = filter.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const params: unknown[] = [LEDGER2_CODE, filter.coopname];
    let pIdx = 3;
    const debitClauses: string[] = [];

    if (filter.processHash) {
      debitClauses.push(`LOWER(d.data ->> 'process_hash') = $${pIdx}`);
      params.push(filter.processHash.toLowerCase());
      pIdx += 1;
    }
    if (filter.debitGlobalSequence) {
      // № проводки = debit.global_sequence (unique). Парный credit подтянется
      // ниже через JOIN (transaction_id + creator_action_ordinal).
      debitClauses.push(`d.global_sequence::bigint = $${pIdx}::bigint`);
      params.push(filter.debitGlobalSequence);
      pIdx += 1;
    }
    if (filter.applyGlobalSequence) {
      // № операции — debit, чей родитель имеет это global_sequence. Связь
      // по (transaction_id, creator_action_ordinal=parent.action_ordinal);
      // имя родителя не ограничиваем — apply / revert одинаково ведут inline debit/credit.
      debitClauses.push(
        `EXISTS (
          SELECT 1 FROM blockchain_actions ap
           WHERE ap.account = d.account
             AND ap.transaction_id = d.transaction_id
             AND ap.action_ordinal = d.creator_action_ordinal
             AND ap.global_sequence::bigint = $${pIdx}::bigint
        )`,
      );
      params.push(filter.applyGlobalSequence);
      pIdx += 1;
    }
    if (filter.username) {
      // username debit/credit-actions не передают (см. ledger2.hpp). Берём из
      // родителя (apply/revert) через точечный JOIN на (transaction_id, action_ordinal).
      debitClauses.push(
        `EXISTS (
          SELECT 1 FROM blockchain_actions ap
           WHERE ap.account = d.account
             AND ap.transaction_id = d.transaction_id
             AND ap.action_ordinal = d.creator_action_ordinal
             AND ap.data ->> 'username' = $${pIdx}
        )`,
      );
      params.push(filter.username);
      pIdx += 1;
    }
    if (filter.dateFrom) {
      debitClauses.push(`d.created_at >= $${pIdx}`);
      params.push(filter.dateFrom);
      pIdx += 1;
    }
    if (filter.dateTo) {
      debitClauses.push(`d.created_at <= $${pIdx}`);
      params.push(filter.dateTo);
      pIdx += 1;
    }
    if (filter.accountId !== undefined) {
      // Попадание в debit ИЛИ credit ноге. Парный credit ищем по точному JOIN
      // (transaction_id, creator_action_ordinal) — тот же оркестратор.
      debitClauses.push(
        `(
          (d.data ->> 'account_id')::text = $${pIdx}
          OR EXISTS (
            SELECT 1 FROM blockchain_actions cc
             WHERE cc.account = d.account
               AND cc.transaction_id = d.transaction_id
               AND cc.creator_action_ordinal = d.creator_action_ordinal
               AND cc.name = 'credit'
               AND (cc.data ->> 'account_id')::text = $${pIdx}
          )
        )`,
      );
      params.push(String(filter.accountId));
      pIdx += 1;
    }

    const debitWhere = `
      d.account = $1
      AND d.name = 'debit'
      AND d.data ->> 'coopname' = $2
      ${debitClauses.length ? 'AND ' + debitClauses.join(' AND ') : ''}
    `;

    const countRow = await this.actionRepo.manager.query(
      `SELECT COUNT(*) AS cnt FROM blockchain_actions d WHERE ${debitWhere}`,
      params,
    );
    const totalCount = parseInt(countRow[0]?.cnt ?? '0', 10);
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    // Пары debit↔credit — точечный LEFT JOIN на (transaction_id, creator_action_ordinal):
    // оба inline вызваны из одного apply, у обоих creator_action_ordinal равен
    // action_ordinal этого apply. Родительский apply подтягивается по
    // (transaction_id, action_ordinal=d.creator_action_ordinal).
    //
    // ledger2::debit принимает поле `amount` (см. ledger2.hpp); в data других
    // ledger2-actions `quantity` нет ни у кого (apply/walletop/walmove/revert
    // тоже только `amount`).
    const rows = await this.actionRepo.manager.query(
      `SELECT
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
        AND ap.action_ordinal = d.creator_action_ordinal
       WHERE ${debitWhere}
       ORDER BY d.block_num ${sortOrder}, d.global_sequence ${sortOrder}
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    );

    const items: Ledger2PostingDomainInterface[] = (
      rows as Array<Record<string, unknown>>
    ).map((r) => {
      const debitSeq = r.debitGlobalSequence != null ? String(r.debitGlobalSequence) : null;
      const creditSeq = r.creditGlobalSequence != null ? String(r.creditGlobalSequence) : null;
      return {
        key: `${debitSeq ?? '_'}_${creditSeq ?? '_'}`,
        blockNum: Number(r.blockNum ?? 0),
        processHash: (r.processHash as string | null) ?? null,
        operationCode: (r.operationCode as string | null) ?? null,
        parentApplyGlobalSequence:
          r.parentApplyGlobalSequence != null ? String(r.parentApplyGlobalSequence) : null,
        debitGlobalSequence: debitSeq,
        debitAccountId: r.debitAccountId != null ? Number(r.debitAccountId) : null,
        creditGlobalSequence: creditSeq,
        creditAccountId: r.creditAccountId != null ? Number(r.creditAccountId) : null,
        quantity: (r.quantity as string | null) ?? null,
        memo: (r.memo as string | null) ?? null,
        username: (r.username as string | null) ?? null,
        createdAt: r.createdAt instanceof Date ? r.createdAt : new Date(String(r.createdAt)),
      };
    });

    return { items, totalCount, totalPages, currentPage: page };
  }
}
