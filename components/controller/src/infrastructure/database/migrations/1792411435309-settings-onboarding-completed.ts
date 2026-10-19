import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Отметка «онбординг завершён» в настройках кооператива. Председатель ставит её
 * вручную на последнем шаге онбординга; по ней пункт «Онбординг» уходит из
 * меню на всех устройствах. До 19.10.2026 отметка жила в localStorage браузера
 * и на другом устройстве пункт появлялся снова.
 */
const UP: readonly string[] = [
  `ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" TIMESTAMP WITH TIME ZONE`,
  `COMMENT ON COLUMN "settings"."onboarding_completed_at" IS 'Когда председатель завершил онбординг кооператива'`,
];

const DOWN: readonly string[] = [`ALTER TABLE "settings" DROP COLUMN IF EXISTS "onboarding_completed_at"`];

export class CoreSettingsOnboardingCompleted1792411435309 implements SchemaMigration {
  name = 'CoreSettingsOnboardingCompleted1792411435309';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
