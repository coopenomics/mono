import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Верификация личности (105-28): выдача имущества на кооперативном участке
 * требует базового уровня верификации получателя (`passport_onsite` — личность
 * сверена с паспортом председателем участка или доверенным лицом). Правило
 * сидируется один раз и дальше управляется кооперативом через verification_rules;
 * существующая запись не перезаписывается.
 *
 * Перенесена дословно из миграции данных `V2.5.3__seed_marketplace_issue_verification_rule.ts` (учёт `2.5.3`): таблицы
 * coop_domain_db — схема, и применяет их сам контроллер при старте. На узле,
 * где миграция данных уже прошла, она не повторяется: учёт переносится.
 */
export class CoopDomainSeedMarketplaceIssueVerificationRule1781000000015 implements SchemaMigration {
  name = 'CoopDomainSeedMarketplaceIssueVerificationRule1781000000015';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO verification_rules (action_code, required_types)
      VALUES ('marketplace.issue_property', '{passport_onsite}')
      ON CONFLICT (action_code) DO NOTHING;
    `);
  }
}
