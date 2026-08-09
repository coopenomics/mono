import { Module } from '@nestjs/common';
import { AUTHN_SESSION_PORT } from '~/domain/auth-v2/ports/authn-session.port';
import { RATE_LIMIT_STORAGE } from '~/domain/auth-v2/ports/rate-limit-storage.port';
import { RECOVERY_TOKEN_STORE } from '~/domain/auth-v2/ports/recovery-token-store.port';
import { TWO_FACTOR_REPOSITORY } from '~/domain/auth-v2/ports/two-factor.port';
import { OFFLINE_RECOVERY_CODE_REPOSITORY } from '~/domain/auth-v2/ports/offline-recovery-code.port';
import { RECOVERY_STRATEGY_REPOSITORY } from '~/domain/auth-v2/ports/recovery-strategy.port';
import { VERIFICATION_RULE_REPOSITORY } from '~/domain/auth-v2/ports/verification-rule.port';
import { KNOWN_DEVICES_STORE } from '~/domain/auth-v2/ports/known-devices-store.port';
import { NEW_DEVICE_NOTIFICATION_THROTTLE } from '~/domain/auth-v2/ports/new-device-notification-throttle.port';
import { SESSION_METADATA_PORT } from '~/domain/auth-v2/ports/session-metadata.port';
import { NOT_ME_TOKEN_STORE } from '~/domain/auth-v2/ports/not-me-token-store.port';
import { CHAIN_MANIFESTS_CACHE } from '~/domain/auth-v2/ports/chain-manifests-cache.port';
import { COOP_SETTINGS_REPOSITORY } from '~/domain/auth-v2/ports/coop-settings.port';
import { ACCESS_RULES_REPOSITORY, ACCESS_RULES_INVALIDATION_PUBLISHER } from '~/domain/auth-v2/ports/access-rules.port';
import { CAPABILITY_SETS_REPOSITORY } from '~/domain/auth-v2/ports/capability-sets.port';
import { PENDING_CRITICAL_ACTIONS_REPOSITORY, CRITICAL_ACTION_NOTIFIER } from '~/domain/auth-v2/ports/pending-critical-actions.port';
import { FORCE_RECOVERY_CONSENT_STORE, FORCE_RECOVERY_CONSENT_NOTIFIER } from '~/domain/auth-v2/ports/force-recovery-consent.port';
import { KEY_REVOCATION_REPOSITORY } from '~/domain/auth-v2/ports/key-revocation.port';
import { AUTHENTIK_ADMIN_PORT } from '~/domain/auth-v2/ports/authentik-admin.port';
import { CERT_KEY_CRYPTO_PORT } from '~/domain/auth-v2/ports/cert-key-crypto.port';
import { CertKeyCryptoAdapter } from './cert-key-crypto.adapter';
import { VAULT_REPOSITORY } from '~/domain/auth-v2/vault/vault-repository.port';
import { RedisModule } from '~/infrastructure/redis/redis.module';
import { AuthentikSessionAdapter } from './authentik-session.adapter';
import { AuthentikAdminAdapter } from './authentik-admin.adapter';
import { PostgresVaultRepository } from './postgres-vault.repository';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { RedisRecoveryTokenStore } from './redis-recovery-token.store';
import { PostgresTwoFactorRepository } from './postgres-two-factor.repository';
import { PostgresOfflineRecoveryCodeRepository } from './postgres-offline-recovery-code.repository';
import { PostgresRecoveryStrategyRepository } from './postgres-recovery-strategy.repository';
import { PostgresVerificationRuleRepository } from './postgres-verification-rule.repository';
import { RedisKnownDevicesStore } from './redis-known-devices.store';
import { RedisNewDeviceNotificationThrottleStore } from './redis-new-device-notification-throttle.store';
import { RedisSessionMetadataStore } from './redis-session-metadata.store';
import { RedisNotMeTokenStore } from './redis-not-me-token.store';
import { RedisChainManifestsStore } from './redis-chain-manifests.store';
import { PostgresCoopSettingsRepository } from './postgres-coop-settings.repository';
import { PostgresAccessRulesRepository } from './postgres-access-rules.repository';
import { PostgresCapabilitySetsRepository } from './postgres-capability-sets.repository';
import { RedisAccessRulesInvalidationPublisher } from './redis-access-rules-invalidation.publisher';
import { PostgresPendingCriticalActionsRepository } from './postgres-pending-critical-actions.repository';
import { RedisCriticalActionNotifier } from './redis-critical-action.notifier';
import { RedisForceRecoveryConsentStore } from './redis-force-recovery-consent.store';
import { RedisForceRecoveryConsentNotifier } from './redis-force-recovery-consent.notifier';
import { PostgresKeyRevocationRepository } from './postgres-key-revocation.repository';

/** Инфраструктурные адаптеры auth-v2 (CoopID): сессия IdP + vault + rate-limit + recovery-token + two-factor + offline-код + recovery-стратегия + known-devices + метаданные сессий. */
@Module({
  imports: [RedisModule],
  providers: [
    { provide: AUTHN_SESSION_PORT, useClass: AuthentikSessionAdapter },
    { provide: VAULT_REPOSITORY, useClass: PostgresVaultRepository },
    { provide: RATE_LIMIT_STORAGE, useClass: RedisThrottlerStorage },
    { provide: RECOVERY_TOKEN_STORE, useClass: RedisRecoveryTokenStore },
    { provide: TWO_FACTOR_REPOSITORY, useClass: PostgresTwoFactorRepository },
    { provide: OFFLINE_RECOVERY_CODE_REPOSITORY, useClass: PostgresOfflineRecoveryCodeRepository },
    { provide: RECOVERY_STRATEGY_REPOSITORY, useClass: PostgresRecoveryStrategyRepository },
    { provide: VERIFICATION_RULE_REPOSITORY, useClass: PostgresVerificationRuleRepository },
    { provide: KNOWN_DEVICES_STORE, useClass: RedisKnownDevicesStore },
    { provide: NEW_DEVICE_NOTIFICATION_THROTTLE, useClass: RedisNewDeviceNotificationThrottleStore },
    { provide: SESSION_METADATA_PORT, useClass: RedisSessionMetadataStore },
    { provide: NOT_ME_TOKEN_STORE, useClass: RedisNotMeTokenStore },
    { provide: CHAIN_MANIFESTS_CACHE, useClass: RedisChainManifestsStore },
    { provide: COOP_SETTINGS_REPOSITORY, useClass: PostgresCoopSettingsRepository },
    { provide: ACCESS_RULES_REPOSITORY, useClass: PostgresAccessRulesRepository },
    { provide: CAPABILITY_SETS_REPOSITORY, useClass: PostgresCapabilitySetsRepository },
    { provide: ACCESS_RULES_INVALIDATION_PUBLISHER, useClass: RedisAccessRulesInvalidationPublisher },
    { provide: PENDING_CRITICAL_ACTIONS_REPOSITORY, useClass: PostgresPendingCriticalActionsRepository },
    { provide: CRITICAL_ACTION_NOTIFIER, useClass: RedisCriticalActionNotifier },
    { provide: FORCE_RECOVERY_CONSENT_STORE, useClass: RedisForceRecoveryConsentStore },
    { provide: FORCE_RECOVERY_CONSENT_NOTIFIER, useClass: RedisForceRecoveryConsentNotifier },
    { provide: KEY_REVOCATION_REPOSITORY, useClass: PostgresKeyRevocationRepository },
    { provide: AUTHENTIK_ADMIN_PORT, useClass: AuthentikAdminAdapter },
    { provide: CERT_KEY_CRYPTO_PORT, useClass: CertKeyCryptoAdapter },
  ],
  exports: [AUTHN_SESSION_PORT, VAULT_REPOSITORY, RATE_LIMIT_STORAGE, RECOVERY_TOKEN_STORE, TWO_FACTOR_REPOSITORY, OFFLINE_RECOVERY_CODE_REPOSITORY, RECOVERY_STRATEGY_REPOSITORY, VERIFICATION_RULE_REPOSITORY, KNOWN_DEVICES_STORE, NEW_DEVICE_NOTIFICATION_THROTTLE, SESSION_METADATA_PORT, NOT_ME_TOKEN_STORE, CHAIN_MANIFESTS_CACHE, COOP_SETTINGS_REPOSITORY, ACCESS_RULES_REPOSITORY, CAPABILITY_SETS_REPOSITORY, ACCESS_RULES_INVALIDATION_PUBLISHER, PENDING_CRITICAL_ACTIONS_REPOSITORY, CRITICAL_ACTION_NOTIFIER, FORCE_RECOVERY_CONSENT_STORE, FORCE_RECOVERY_CONSENT_NOTIFIER, KEY_REVOCATION_REPOSITORY, AUTHENTIK_ADMIN_PORT, CERT_KEY_CRYPTO_PORT],
})
export class AuthV2InfrastructureModule {}
