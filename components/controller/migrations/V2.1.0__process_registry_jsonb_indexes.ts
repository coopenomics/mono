import type { DataSource } from 'typeorm';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * Epic 4 + Epic 1 addendum + Epic 4 review: jsonb expression indexes для
 * эффективного поиска по `process_hash` в ProcessRegistryService.
 *
 * Phase A идёт через `blockchain_actions` (wjournal+journal убраны из RAM).
 * Phase B — через `blockchain_deltas` для entity-таблиц из PROCESS_HASH_LOCATOR.
 *
 * Критично: сервис фильтрует через `LOWER(value->>'field')`, поэтому все
 * expression-индексы строятся на LOWER(...). Без LOWER планировщик не
 * выбирает индекс и упирается в seq-scan по миллионам дельт.
 *
 * Coopname-фильтр: сервис делает `scope = :coop OR value->>'coopname' = :coop`
 * (OR покрывает и coop-scope таблицы, и singleton-scope типа registrator).
 * OR-конструкция НЕ ложится в один expression-index — поэтому coopname не
 * включаем в индекс; после lookup по hash постфильтрация по scope/value
 * дёшевая (обычно ≤5 строк на hash).
 *
 * Имена таблиц/полей — строгая сверка с контрактами (`cpp/.../entities/*.hpp`,
 * `cpp/lib/domain/table_*.hpp`):
 *   - registrator::candidates2.registration_hash  (НЕ "regs")
 *   - capital::debts.debt_hash
 *   - capital::results.result_hash
 *   - capital::contributors.contributor_hash
 *   - capital::pgproperties.property_hash  (НЕ "properties")
 *   - wallet::deposits.deposit_hash
 *   - wallet::withdraws.withdraw_hash
 *   - marketplace::requests.hash  (поле называется "hash", НЕ "request_hash")
 */
export default {
  name: 'process-registry jsonb expression indexes (blockchain_actions + entity tables)',

  async up({ dataSource, logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    try {
      // Drop устаревших / переименованных индексов (re-run safety).
      const legacy = [
        'idx_deltas_ledger2_process_hash',
        'idx_deltas_ledger2_process_type',
        'idx_deltas_ledger2_wjournal_username',
        'idx_actions_ledger2_process_hash',
        // Pre-review: индексы без LOWER() были, планировщик их не использовал.
        'idx_actions_process_hash',
        'idx_deltas_capital_debts_debt_hash',
        'idx_deltas_capital_results_result_hash',
        'idx_deltas_capital_segments_result_hash',
        'idx_deltas_capital_contribs_contributor_hash',
        'idx_deltas_capital_properties_property_hash',
        'idx_deltas_wallet_deposits_deposit_hash',
        'idx_deltas_wallet_withdraws_withdraw_hash',
        'idx_deltas_registrator_regs_registration_hash',
        'idx_deltas_marketplace_requests_request_hash',
      ];
      for (const idx of legacy) {
        await dataSource.query(`DROP INDEX IF EXISTS "${idx}"`);
      }

      // ----- phase A: blockchain_actions cross-account -----
      // process_hash приходит LOWER-case → индекс по LOWER(data->>'process_hash').
      // coopname не в индексе: OR (scope/value) — в phase B, здесь coopname
      // всегда в data->>'coopname'; кладём как вторичный ключ.
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS "idx_actions_process_hash_lower"
          ON "blockchain_actions" ((LOWER("data" ->> 'process_hash')), ("data" ->> 'coopname'))
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS "idx_actions_ledger2_apply_action_code"
          ON "blockchain_actions" (("data" ->> 'action_code'), ("data" ->> 'coopname'))
          WHERE account = 'ledger2' AND name = 'apply'
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS "idx_actions_ledger2_apply_username"
          ON "blockchain_actions" (("data" ->> 'username'), ("data" ->> 'coopname'))
          WHERE account = 'ledger2' AND name = 'apply'
      `);

      // ----- phase B: entity tables из PROCESS_HASH_LOCATOR -----
      // LOWER() обязательно — сервис сравнивает через LOWER(value->>'field').
      // coopname в индексе НЕ кладём: OR (scope/value.coopname) не покрывается
      // одним expression index. Постфильтр по scope/coopname дёшев (≤5 строк).
      type EntityIndex = { idx: string; code: string; table: string; field: string };
      const entityIndexes: EntityIndex[] = [
        { idx: 'idx_deltas_capital_debts_lower',      code: 'capital',     table: 'debts',        field: 'debt_hash' },
        { idx: 'idx_deltas_capital_results_lower',    code: 'capital',     table: 'results',      field: 'result_hash' },
        { idx: 'idx_deltas_capital_contribs_lower',   code: 'capital',     table: 'contributors', field: 'contributor_hash' },
        { idx: 'idx_deltas_capital_pgprops_lower',    code: 'capital',     table: 'pgproperties', field: 'property_hash' },
        { idx: 'idx_deltas_wallet_deposits_lower',    code: 'wallet',      table: 'deposits',     field: 'deposit_hash' },
        { idx: 'idx_deltas_wallet_withdraws_lower',   code: 'wallet',      table: 'withdraws',    field: 'withdraw_hash' },
        { idx: 'idx_deltas_registrator_cand2_lower',  code: 'registrator', table: 'candidates2',  field: 'registration_hash' },
        { idx: 'idx_deltas_marketplace_requests_lower', code: 'marketplace', table: 'requests',   field: 'hash' },
      ];
      // Identifier-whitelist: значения идут в SQL через интерполяцию (pg-клиент
      // не поддерживает параметры в DDL для имени индекса / имени поля внутри
      // выражения `value->>'X'`). Входные данные — литералы в коде, но на
      // случай future-edit защищаемся: отвергаем всё, что не `[a-z0-9_]+`.
      // Никакой SQL-инъекции даже при будущих добавлениях.
      const safeIdent = /^[a-z0-9_]+$/;
      for (const { idx, code, table, field } of entityIndexes) {
        for (const [label, value] of Object.entries({ idx, code, table, field })) {
          if (!safeIdent.test(value)) {
            throw new Error(`V2.1.0 migration: небезопасное значение ${label}="${value}" — допустим только [a-z0-9_]+`);
          }
        }
        await dataSource.query(
          `CREATE INDEX IF NOT EXISTS "${idx}"
            ON "blockchain_deltas" ((LOWER("value" ->> '${field}')))
            WHERE code = '${code}' AND "table" = '${table}'`,
        );
      }

      logger.info(
        `process-registry: expression indexes созданы (3 actions + ${entityIndexes.length} deltas, LOWER-aware)`,
      );
      return true;
    } catch (e) {
      logger.error(
        `Ошибка миграции V2.1.0 (process-registry indexes): ${e instanceof Error ? e.message : String(e)}`
      );
      return false;
    }
  },

  async down({ dataSource, logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    try {
      const indexes = [
        'idx_actions_process_hash_lower',
        'idx_actions_ledger2_apply_action_code',
        'idx_actions_ledger2_apply_username',
        'idx_deltas_capital_debts_lower',
        'idx_deltas_capital_results_lower',
        'idx_deltas_capital_contribs_lower',
        'idx_deltas_capital_pgprops_lower',
        'idx_deltas_wallet_deposits_lower',
        'idx_deltas_wallet_withdraws_lower',
        'idx_deltas_registrator_cand2_lower',
        'idx_deltas_marketplace_requests_lower',
      ];
      for (const idx of indexes) {
        await dataSource.query(`DROP INDEX IF EXISTS "${idx}"`);
      }
      logger.warn('Откат V2.1.0: expression indexes удалены');
      return true;
    } catch (e) {
      logger.error(`Ошибка отката V2.1.0: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  },
};
