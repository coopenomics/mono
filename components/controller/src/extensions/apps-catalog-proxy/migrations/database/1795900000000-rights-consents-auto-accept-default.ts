import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Новые права ядра принимаются без подтверждения председателя (487-37,
 * слово владельца 28.11.2026: «поставим всем… и в интерфейсе скроем, пока
 * обновляем без требования к председателю нажимать подтверждение»).
 *
 * Признак «Принимать новые права» включается всем приложениям и становится
 * значением по умолчанию. Запрос, который уже ждёт председателя, оркестратор
 * повторит при следующей проверке выпусков: согласие узел даст сам.
 * Первая установка по-прежнему проходит шаг согласия на права.
 */
const UP: readonly string[] = [
  'ALTER TABLE "apps_rights_consents" ALTER COLUMN "auto_accept" SET DEFAULT true',
  // Только приложения с согласием председателя: строка без согласия — запрос
  // первой установки, его решает председатель.
  'UPDATE "apps_rights_consents" SET "auto_accept" = true WHERE "auto_accept" = false AND "consented_by" IS NOT NULL',
];

const DOWN: readonly string[] = ['ALTER TABLE "apps_rights_consents" ALTER COLUMN "auto_accept" SET DEFAULT false'];

export class AppsCatalogProxyRightsConsentsAutoAcceptDefault1795900000000 implements SchemaMigration {
  name = 'AppsCatalogProxyRightsConsentsAutoAcceptDefault1795900000000';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
