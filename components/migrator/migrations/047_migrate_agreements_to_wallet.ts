/**
 * Миграция программных соглашений (program_id > 0) из soviet::agreements3
 * в wallet::users (Эпик 2 / story 2.5; ADR-008).
 *
 * Per-coop self-service: для каждого coop из registrator::cooperatives2 читает
 * agreements3 и для каждой подтверждённой записи с program_id > 0 вызывает
 * wallet::migrate3 (идемпотентно).
 *
 * Не-программные соглашения (program_id == 0) остаются в soviet::agreements3.
 *
 * Записи в soviet::agreements3 НЕ удаляются этой миграцией — это сделает
 * Эпик 4 (финальный deploy soviet); до тех пор мигрированные записи там
 * остаются как избыточная копия (контракт их игнорирует — sndagreement/
 * confirmagree/declineagree уже отказывают для program_id > 0).
 */

import { SovietContract, WalletContract } from 'cooptypes';
import type { Migration } from '../src/migration_interface';
import { api } from '../src/eos';
import { listCoops } from '../src/utils/listCoops';
import { fetchAllRows } from '../src/utils/fetchAllRows';

const BATCH = 50; // максимум migrate3 actions в одной tx

export class MigrateAgreementsToWallet implements Migration {
  async run(): Promise<void> {
    const coops = await listCoops();
    console.log(`[047] Кооперативов найдено: ${coops.length}`);

    let totalMigrated = 0;

    for (const coopname of coops) {
      const agreements = await fetchAllRows<SovietContract.Tables.Agreements.IAgreement>({
        code: SovietContract.contractName.production,
        scope: coopname,
        table: SovietContract.Tables.Agreements.tableName,
      });

      // Статус в agreements3 — eosio::name. Для program_id > 0 он практически
      // всегда пустой (""): sndagreement записывает ""_n, а confirmagree после
      // Эпика 2 не вызывается — воркфлоу подписания уехал в wallet::signagree.
      // Поэтому мигрируем все program-записи кроме явно отклонённых.
      const programmatic = agreements.filter((a) =>
        Number(a.program_id) > 0 && a.status !== 'declined'
      );

      if (programmatic.length === 0) {
        console.log(`[047] ${coopname}: нет программных соглашений — пропуск`);
        continue;
      }

      console.log(`[047] ${coopname}: программных соглашений ${programmatic.length}`);

      for (let i = 0; i < programmatic.length; i += BATCH) {
        const chunk = programmatic.slice(i, i + BATCH);
        const actions = chunk.map((a) => ({
          account: WalletContract.contractName.production,
          name: WalletContract.Actions.Migrate3.actionName,
          authorization: [{ actor: WalletContract.contractName.production, permission: 'active' }],
          data: {
            coopname,
            username: a.username,
            program_id: Number(a.program_id),
            doc_hash: a.document?.hash ?? '0000000000000000000000000000000000000000000000000000000000000000',
            version: Number(a.version ?? 0),
            draft_id: Number(a.draft_id ?? 0),
            signed_at: a.updated_at,
          },
        }));

        await api.transact(
          { actions },
          { blocksBehind: 3, expireSeconds: 30 }
        );

        totalMigrated += chunk.length;
        console.log(`[047] ${coopname}: ${chunk.length} соглашений → wallet::users`);
      }
    }

    console.log(`[047] Готово: всего мигрировано ${totalMigrated} соглашений`);
  }
}
