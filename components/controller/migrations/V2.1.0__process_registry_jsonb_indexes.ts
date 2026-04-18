import type { DataSource } from 'typeorm';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * Epic 4 Story 4.10: jsonb expression indexes на `blockchain_deltas` для
 * эффективного поиска по `process_hash`, `process_type` и entity-полям из
 * `PROCESS_HASH_LOCATOR`.
 *
 * Ключевые паттерны SQL запросов ProcessRegistryService:
 *   - phase A: WHERE code='_ledger2' AND table IN ('wjournal','journal')
 *                AND value->>'process_hash' = $hash
 *                AND value->>'coopname' = $coop
 *   - phase B: WHERE code=$loc.code AND table=$loc.table
 *                AND value->>$loc.field = $hash
 *                AND value->>'coopname' = $coop
 *   - listProcesses: GROUP BY value->>'process_hash' на wjournal
 *
 * Все индексы идемпотентны (`IF NOT EXISTS`), используют partial-index
 * через WHERE на `code` для минимизации размера.
 */
export default {
  name: 'process-registry jsonb expression indexes on blockchain_deltas',

  async up({ dataSource, logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    try {
      // ----- phase A: ledger2 journals -----
      // Важно: ledger2 wjournal/journal хранят coopname как scope, а не в
      // value.jsonb — индексы покрывают (process_hash, scope) и аналогично
      // для process_type/username.
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS "idx_deltas_ledger2_process_hash"
          ON "blockchain_deltas" (("value"->>'process_hash'), scope)
          WHERE code = 'ledger2' AND "table" IN ('wjournal','journal')
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS "idx_deltas_ledger2_process_type"
          ON "blockchain_deltas" (("value"->>'process_type'), scope)
          WHERE code = 'ledger2' AND "table" IN ('wjournal','journal')
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS "idx_deltas_ledger2_wjournal_username"
          ON "blockchain_deltas" (("value"->>'username'), scope)
          WHERE code = 'ledger2' AND "table" = 'wjournal'
      `);

      // ----- phase B: entity tables из PROCESS_HASH_LOCATOR -----
      // capital
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS "idx_deltas_capital_debts_debt_hash"
          ON "blockchain_deltas" (("value"->>'debt_hash'), ("value"->>'coopname'))
          WHERE code = 'capital' AND "table" = 'debts'
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS "idx_deltas_capital_results_result_hash"
          ON "blockchain_deltas" (("value"->>'result_hash'), ("value"->>'coopname'))
          WHERE code = 'capital' AND "table" = 'results'
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS "idx_deltas_capital_segments_result_hash"
          ON "blockchain_deltas" (("value"->>'result_hash'), ("value"->>'coopname'))
          WHERE code = 'capital' AND "table" = 'segments'
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS "idx_deltas_capital_contribs_contributor_hash"
          ON "blockchain_deltas" (("value"->>'contributor_hash'), ("value"->>'coopname'))
          WHERE code = 'capital' AND "table" = 'contributors'
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS "idx_deltas_capital_properties_property_hash"
          ON "blockchain_deltas" (("value"->>'property_hash'), ("value"->>'coopname'))
          WHERE code = 'capital' AND "table" = 'properties'
      `);

      // wallet
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS "idx_deltas_wallet_deposits_deposit_hash"
          ON "blockchain_deltas" (("value"->>'deposit_hash'), ("value"->>'coopname'))
          WHERE code = 'wallet' AND "table" = 'deposits'
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS "idx_deltas_wallet_withdraws_withdraw_hash"
          ON "blockchain_deltas" (("value"->>'withdraw_hash'), ("value"->>'coopname'))
          WHERE code = 'wallet' AND "table" = 'withdraws'
      `);

      // registrator
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS "idx_deltas_registrator_regs_registration_hash"
          ON "blockchain_deltas" (("value"->>'registration_hash'), ("value"->>'coopname'))
          WHERE code = 'registrator' AND "table" = 'regs'
      `);

      // marketplace
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS "idx_deltas_marketplace_requests_request_hash"
          ON "blockchain_deltas" (("value"->>'request_hash'), ("value"->>'coopname'))
          WHERE code = 'marketplace' AND "table" = 'requests'
      `);

      logger.info('process-registry: expression indexes созданы (11 шт.)');
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
        'idx_deltas_ledger2_process_hash',
        'idx_deltas_ledger2_process_type',
        'idx_deltas_ledger2_wjournal_username',
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
