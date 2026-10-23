import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Код приложения-аутентификатора принимается один раз: в `two_factor`
 * запоминается шаг времени последнего принятого кода (`last_used_step`), и
 * тот же код повторно не проходит. До 25.09.2026 один код годился дважды
 * подряд — подслушанный код давал второе действие.
 *
 * Перенесена дословно из миграции данных `202609250900__coopid_two_factor_last_used_step.ts` (учёт `202609250900`): таблицы
 * coop_domain_db — схема, и применяет их сам контроллер при старте. На узле,
 * где миграция данных уже прошла, она не повторяется: учёт переносится.
 */
export class CoopDomainTwoFactorLastUsedStep1781000000017 implements SchemaMigration {
  name = 'CoopDomainTwoFactorLastUsedStep1781000000017';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE two_factor ADD COLUMN IF NOT EXISTS last_used_step bigint`);
  }
}
