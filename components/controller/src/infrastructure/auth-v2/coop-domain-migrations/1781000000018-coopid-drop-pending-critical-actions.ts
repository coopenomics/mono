import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Таблица `pending_critical_actions` удаляется из coop_domain_db.
 *
 * Заготовка критических действий совета (две подписи) убрана с сервера
 * 02.10.2026: ею никто не пользовался, проведённое действие ничего не
 * исполняло. Кода, который читает или пишет таблицу, больше нет. Число строк
 * перед удалением пишется в журнал; сведения о проведённых действиях остаются
 * в журнале аудита.
 *
 * Перенесена дословно из миграции данных `202610030550__coopid_drop_pending_critical_actions.ts` (учёт `202610030550`): таблицы
 * coop_domain_db — схема, и применяет их сам контроллер при старте. На узле,
 * где миграция данных уже прошла, она не повторяется: учёт переносится.
 */
export class CoopDomainDropPendingCriticalActions1781000000018 implements SchemaMigration {
  name = 'CoopDomainDropPendingCriticalActions1781000000018';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    const [{ exists }] = await queryRunner.query(`SELECT to_regclass('pending_critical_actions') IS NOT NULL AS exists`);
    if (!exists) {
      return;
    }
    await queryRunner.query(`DROP TABLE pending_critical_actions`);
  }
}
