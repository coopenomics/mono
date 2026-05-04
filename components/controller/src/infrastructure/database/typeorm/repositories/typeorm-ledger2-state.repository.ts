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

const LEDGER2_CODE = Ledger2Contract.contractName.production;

/**
 * Чтение состояния ledger2 из Postgres-таблиц блокчейн-синка.
 *
 * - Текущие балансы: `SELECT DISTINCT ON (primary_key) ... ORDER BY primary_key,
 *   block_num DESC, created_at DESC` — берём последнюю дельту для каждого id.
 *   Deltas-consumer (`BlockchainConsumerService`) уже наполняет таблицу,
 *   отдельной подписки не нужно.
 *
 * - История операций: `blockchain_actions WHERE account='ledger2'` —
 *   source-of-truth для трио apply+walletop+debit+credit (см.
 *   ProcessRegistryService: та же стратегия).
 */
@Injectable()
export class TypeOrmLedger2StateRepository implements Ledger2StatePort {
  constructor(
    @InjectRepository(DeltaEntity) private readonly deltaRepo: Repository<DeltaEntity>,
    @InjectRepository(ActionEntity) private readonly actionRepo: Repository<ActionEntity>,
  ) {}

  async getAccounts(coopname: string): Promise<Ledger2AccountDomainInterface[]> {
    const rows = await this.deltaRepo.manager.query(
      `SELECT DISTINCT ON (primary_key) value
       FROM blockchain_deltas
       WHERE code = $1 AND "table" = '${Ledger2Contract.Tables.Accounts.tableName}' AND scope = $2
       ORDER BY primary_key, block_num DESC, created_at DESC`,
      [LEDGER2_CODE, coopname],
    );
    return (rows as Array<{ value: Record<string, unknown> }>).map((row) => {
      const v = row.value ?? {};
      return {
        id: parseInt(String(v.id ?? 0), 10),
        name: String(v.name ?? ''),
        balance: String(v.balance ?? '0.0000 RUB'),
        debitBalance: String(v.debit_balance ?? '0.0000 RUB'),
        creditBalance: String(v.credit_balance ?? '0.0000 RUB'),
        accountType: typeof v.account_type === 'number' ? v.account_type : Number(v.account_type ?? 0),
      };
    });
  }

  async getWallets(coopname: string): Promise<Ledger2WalletDomainInterface[]> {
    const rows = await this.deltaRepo.manager.query(
      `SELECT DISTINCT ON (primary_key) value
       FROM blockchain_deltas
       WHERE code = $1 AND "table" = '${Ledger2Contract.Tables.Wallets.tableName}' AND scope = $2
       ORDER BY primary_key, block_num DESC, created_at DESC`,
      [LEDGER2_CODE, coopname],
    );
    return (rows as Array<{ value: Record<string, unknown> }>).map((row) => {
      const v = row.value ?? {};
      return {
        id: String(v.id ?? ''),
        name: String(v.name ?? ''),
        available: String(v.available ?? '0.0000 RUB'),
        blocked: String(v.blocked ?? '0.0000 RUB'),
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
      // Бух.счёт (debit/credit действий) — числовой. apply-события не имеют account_id
      // в data, связь идёт через process_hash с siblings (debit/credit). Для raw-siblings
      // достаточно прямого совпадения.
      const siblingOnly =
        !!filter.actionNames &&
        filter.actionNames.length > 0 &&
        !filter.actionNames.includes('apply');
      if (siblingOnly) {
        clauses.push(
          `(
            (a.data ->> 'id')::text = $${pIdx}
            OR (a.data ->> 'account_id')::text = $${pIdx}
          )`,
        );
      } else {
        clauses.push(
          `LOWER(a.data ->> 'process_hash') IN (
             SELECT LOWER(b.data ->> 'process_hash')
             FROM blockchain_actions b
             WHERE b.account = $1
               AND b.data ->> 'coopname' = $2
               AND b.data ->> 'process_hash' IS NOT NULL
               AND (
                 (b.data ->> 'id')::text = $${pIdx}
                 OR (b.data ->> 'account_id')::text = $${pIdx}
               )
           )`,
        );
      }
      params.push(String(filter.accountId));
      pIdx += 1;
    }
    if (filter.walletName) {
      // Кошелёк (walletop действий) — eosio::name. Для apply-событий wallet_from/to нет
      // в data, поэтому фильтр через process_hash подтягивает все 3 действия (apply +
      // walletop + debit/credit) одного процесса, в котором участвует этот кошелёк.
      const siblingOnly =
        !!filter.actionNames &&
        filter.actionNames.length > 0 &&
        !filter.actionNames.includes('apply');
      if (siblingOnly) {
        clauses.push(
          `(
            (a.data ->> 'wallet_from') = $${pIdx}
            OR (a.data ->> 'wallet_to') = $${pIdx}
            OR (a.data ->> 'id') = $${pIdx}
          )`,
        );
      } else {
        clauses.push(
          `LOWER(a.data ->> 'process_hash') IN (
             SELECT LOWER(b.data ->> 'process_hash')
             FROM blockchain_actions b
             WHERE b.account = $1
               AND b.data ->> 'coopname' = $2
               AND b.data ->> 'process_hash' IS NOT NULL
               AND (
                 (b.data ->> 'wallet_from') = $${pIdx}
                 OR (b.data ->> 'wallet_to') = $${pIdx}
                 OR (b.data ->> 'id') = $${pIdx}
               )
           )`,
        );
      }
      params.push(filter.walletName);
      pIdx += 1;
    }
    if (filter.processHash) {
      clauses.push(`LOWER(a.data ->> 'process_hash') = $${pIdx}`);
      params.push(filter.processHash.toLowerCase());
      pIdx += 1;
    }
    if (filter.parentApplyGlobalSequence && filter.processHash) {
      // Ограничиваем siblings (walletop/debit/credit) диапазоном global_sequence
      // между текущим apply и следующим apply того же processHash — чтобы
      // раскрытие одного apply не цепляло сибсов соседних apply в multi-effect
      // процессах (p.cap.rid: две пары operation_code внутри одного processHash).
      // global_sequence хранится как varchar(32), для числового сравнения
      // кастим обе стороны к bigint.
      clauses.push(`a.global_sequence::bigint > $${pIdx}::bigint`);
      params.push(filter.parentApplyGlobalSequence);
      const pIdxHash = pIdx + 1;
      clauses.push(
        `a.global_sequence::bigint < COALESCE(
           (SELECT MIN(b.global_sequence::bigint)
              FROM blockchain_actions b
             WHERE b.account = $1
               AND b.name = 'apply'
               AND LOWER(b.data ->> 'process_hash') = $${pIdxHash}
               AND b.global_sequence::bigint > $${pIdx}::bigint),
           9223372036854775807::bigint
         )`,
      );
      params.push(filter.processHash.toLowerCase());
      pIdx += 2;
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
      createdAt: r.createdAt instanceof Date ? r.createdAt : new Date(String(r.createdAt)),
    }));

    return { items, totalCount, totalPages, currentPage: page };
  }
}
