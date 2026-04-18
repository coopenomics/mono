import type { DataSource } from 'typeorm';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * Epic 4 + Epic 1 addendum (2026-04-18): jsonb expression indexes для
 * эффективного поиска по `process_hash` в ProcessRegistryService.
 *
 * Phase A теперь идёт через `blockchain_actions` (а не `blockchain_deltas`),
 * поскольку wjournal+journal в RAM убраны. Phase B остаётся на
 * `blockchain_deltas` для entity-таблиц из `PROCESS_HASH_LOCATOR`.
 *
 * Ключевые паттерны SQL запросов ProcessRegistryService:
 *   - phase A: WHERE account='ledger2' AND name IN ('apply','walletop','debit','credit')
 *                AND LOWER(data->>'process_hash') = $hash
 *                AND data->>'coopname' = $coop
 *   - phase B: WHERE code=$loc.code AND table=$loc.table
 *                AND value->>$loc.field = $hash
 *                AND value->>'coopname' = $coop
 *   - listProcesses: blockchain_actions, GROUP BY data->>'process_hash'
 */
export default {
  name: 'process-registry jsonb expression indexes (blockchain_actions + entity tables)',

  async up({ dataSource, logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    try {
      // Удаляем устаревшие индексы по wjournal/journal (если были созданы)
      await dataSource.query(`DROP INDEX IF EXISTS "idx_deltas_ledger2_process_hash"`);
      await dataSource.query(`DROP INDEX IF EXISTS "idx_deltas_ledger2_process_type"`);
      await dataSource.query(`DROP INDEX IF EXISTS "idx_deltas_ledger2_wjournal_username"`);

      // ----- phase A: blockchain_actions (ledger2) -----
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS "idx_actions_ledger2_process_hash"
          ON "blockchain_actions" ((LOWER("data" ->> 'process_hash')), ("data" ->> 'coopname'))
          WHERE account = 'ledger2'
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

      logger.info('process-registry: expression indexes созданы (3 actions + 8 deltas; wjournal/journal удалены)');
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
        'idx_actions_ledger2_process_hash',
        'idx_actions_ledger2_apply_action_code',
        'idx_actions_ledger2_apply_username',
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
