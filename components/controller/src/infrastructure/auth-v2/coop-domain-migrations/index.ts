import type { SchemaMigrationClass } from '@coopenomics/extension-kit';
import { CoopDomainInit1781000000000 } from './1781000000000-coopid-coop-domain-db-init';
import { CoopDomainVaultVersionColumnsText1781000000001 } from './1781000000001-coopid-vault-version-columns-text';
import { CoopDomainTwoFactor1781000000002 } from './1781000000002-coopid-two-factor';
import { CoopDomainOfflineRecoveryCode1781000000003 } from './1781000000003-coopid-offline-recovery-code';
import { CoopDomainRecoveryStrategy1781000000004 } from './1781000000004-coopid-recovery-strategy';
import { CoopDomainVerificationRules1781000000005 } from './1781000000005-coopid-verification-rules';
import { CoopDomainCoopSettings1781000000006 } from './1781000000006-coopid-coop-settings';
import { CoopDomainAccessRules1781000000007 } from './1781000000007-coopid-access-rules';
import { CoopDomainAccessRulesReconcile1781000000008 } from './1781000000008-coopid-access-rules-reconcile';
import { CoopDomainPendingCriticalActions1781000000009 } from './1781000000009-coopid-pending-critical-actions';
import { CoopDomainRevokedKeys1781000000010 } from './1781000000010-coopid-revoked-keys';
import { CoopDomainAuditEventsSchema1781000000011 } from './1781000000011-coopid-audit-events-schema';
import { CoopDomainCapabilitySets1781000000012 } from './1781000000012-coopid-capability-sets';
import { CoopDomainLoginFactors1781000000013 } from './1781000000013-coopid-login-factors';
import { CoopDomainAuditResultPending1781000000014 } from './1781000000014-coopid-audit-result-pending';
import { CoopDomainSeedMarketplaceIssueVerificationRule1781000000015 } from './1781000000015-seed-marketplace-issue-verification-rule';
import { CoopDomainVerificationReviews1781000000016 } from './1781000000016-coopid-verification-reviews';
import { CoopDomainTwoFactorLastUsedStep1781000000017 } from './1781000000017-coopid-two-factor-last-used-step';
import { CoopDomainDropPendingCriticalActions1781000000018 } from './1781000000018-coopid-drop-pending-critical-actions';

/**
 * Миграции схемы базы CoopID (coop_domain_db) — в порядке применения.
 *
 * До 20.10.2026 эти таблицы создавались миграциями данных, а миграции данных на
 * узлах идут только с выпуском (AUTO_MIGRATE выключен). Узел после первой
 * установки стоял без таблиц CoopID, и пароль по приглашению не задавался
 * («relation "revoked_keys" does not exist», тестнет, duhempijbika). Теперь их,
 * как и таблицы основной базы, применяет сам контроллер при старте.
 *
 * Новая таблица или колонка coop_domain_db — новая миграция здесь, в конце списка.
 */
export const coopDomainDatabaseMigrations: ReadonlyArray<SchemaMigrationClass> = [
  CoopDomainInit1781000000000,
  CoopDomainVaultVersionColumnsText1781000000001,
  CoopDomainTwoFactor1781000000002,
  CoopDomainOfflineRecoveryCode1781000000003,
  CoopDomainRecoveryStrategy1781000000004,
  CoopDomainVerificationRules1781000000005,
  CoopDomainCoopSettings1781000000006,
  CoopDomainAccessRules1781000000007,
  CoopDomainAccessRulesReconcile1781000000008,
  CoopDomainPendingCriticalActions1781000000009,
  CoopDomainRevokedKeys1781000000010,
  CoopDomainAuditEventsSchema1781000000011,
  CoopDomainCapabilitySets1781000000012,
  CoopDomainLoginFactors1781000000013,
  CoopDomainAuditResultPending1781000000014,
  CoopDomainSeedMarketplaceIssueVerificationRule1781000000015,
  CoopDomainVerificationReviews1781000000016,
  CoopDomainTwoFactorLastUsedStep1781000000017,
  CoopDomainDropPendingCriticalActions1781000000018,
];

/**
 * Версия в учёте миграций данных (таблица `migrations` основной базы), под
 * которой миграция прошла до переноса. Узел, где она там отмечена успешной,
 * получает отметку в учёте схемы без повторного выполнения.
 */
export const COOP_DOMAIN_LEGACY_VERSIONS: Readonly<Record<string, string>> = {
  CoopDomainInit1781000000000: '2.3.8',
  CoopDomainVaultVersionColumnsText1781000000001: '2.4.1',
  CoopDomainTwoFactor1781000000002: '2.4.2',
  CoopDomainOfflineRecoveryCode1781000000003: '2.4.3',
  CoopDomainRecoveryStrategy1781000000004: '2.4.4',
  CoopDomainVerificationRules1781000000005: '2.4.5',
  CoopDomainCoopSettings1781000000006: '2.4.6',
  CoopDomainAccessRules1781000000007: '2.4.7',
  CoopDomainAccessRulesReconcile1781000000008: '2.4.8',
  CoopDomainPendingCriticalActions1781000000009: '2.4.9',
  CoopDomainRevokedKeys1781000000010: '2.4.10',
  CoopDomainAuditEventsSchema1781000000011: '2.4.11',
  CoopDomainCapabilitySets1781000000012: '2.4.12',
  CoopDomainLoginFactors1781000000013: '2.4.13',
  CoopDomainAuditResultPending1781000000014: '2.4.14',
  CoopDomainSeedMarketplaceIssueVerificationRule1781000000015: '2.5.3',
  CoopDomainVerificationReviews1781000000016: '2.5.4',
  CoopDomainTwoFactorLastUsedStep1781000000017: '202609250900',
  CoopDomainDropPendingCriticalActions1781000000018: '202610030550',
};
