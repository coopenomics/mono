import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * CoopID Story 2.1 (фикс схемы 1.4): cipher_version/kdf_version в `vaults` —
 * текстовые версии ('aes-256-gcm-v1' / 'argon2id-v1'), а не smallint.
 * V2.4.0 объявила их smallint по недосмотру; правим отдельной миграцией,
 * т.к. применённые миграции иммутабельны. Таблица на этом этапе пуста.
 *
 * Перенесена дословно из миграции данных `V2.4.1__coopid_vault_version_columns_text.ts` (учёт `2.4.1`): таблицы
 * coop_domain_db — схема, и применяет их сам контроллер при старте. На узле,
 * где миграция данных уже прошла, она не повторяется: учёт переносится.
 */
export class CoopDomainVaultVersionColumnsText1781000000001 implements SchemaMigration {
  name = 'CoopDomainVaultVersionColumnsText1781000000001';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE vaults ALTER COLUMN cipher_version TYPE text USING cipher_version::text`);
    await queryRunner.query(`ALTER TABLE vaults ALTER COLUMN kdf_version TYPE text USING kdf_version::text`);
    await queryRunner.query(`ALTER TABLE vaults ALTER COLUMN cipher_version SET DEFAULT 'aes-256-gcm-v1'`);
    await queryRunner.query(`ALTER TABLE vaults ALTER COLUMN kdf_version SET DEFAULT 'argon2id-v1'`);
  }
}
