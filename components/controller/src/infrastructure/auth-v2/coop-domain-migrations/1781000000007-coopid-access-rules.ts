// i18n-ignore-file: SQL миграции схемы CoopID и сообщения для оператора, до пайщика не доходят
import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * CoopID Story 6.2: CASL Layer 2 — декларативные точечные права. Таблица
 * `access_rules` в coop_domain_db: правило навешивается на роль (`subject_type='role'`,
 * `subject_id` = имя core-роли) либо на конкретного пайщика (`subject_type='participant'`,
 * `subject_id` = username). `effect` allow/deny, `action`/`resource_type` — CASL-словарь,
 * `conditions` — CASL-условия (jsonb). `expires_at` — TTL точечных capabilities (Story 6.7).
 *
 * Перенесена дословно из миграции данных `V2.4.7__coopid_access_rules.ts` (учёт `2.4.7`): таблицы
 * coop_domain_db — схема, и применяет их сам контроллер при старте. На узле,
 * где миграция данных уже прошла, она не повторяется: учёт переносится.
 */
export class CoopDomainAccessRules1781000000007 implements SchemaMigration {
  name = 'CoopDomainAccessRules1781000000007';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    // V2.4.0 init создал плейсхолдер access_rules со старой схемой (role/action/subject)
    // без колонки subject_type. На такой БД `CREATE TABLE IF NOT EXISTS` ниже = no-op,
    // а индекс по subject_type упал бы. Сносим пустой плейсхолдер (Layer 2 ещё ниоткуда
    // не пишется → DROP безопасен). Идемпотентно: при правильной схеме DROP не выполняется.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'access_rules'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'access_rules' AND column_name = 'subject_type'
        ) THEN
          DROP TABLE access_rules;
          RAISE NOTICE 'access_rules: снесён плейсхолдер V2.4.0';
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS access_rules (
        id bigserial PRIMARY KEY,
        subject_type text NOT NULL,
        subject_id text NOT NULL,
        effect text NOT NULL DEFAULT 'allow',
        action text NOT NULL,
        resource_type text NOT NULL,
        conditions jsonb,
        expires_at timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_access_rules_principal ON access_rules (subject_type, subject_id);`);
  }
}
