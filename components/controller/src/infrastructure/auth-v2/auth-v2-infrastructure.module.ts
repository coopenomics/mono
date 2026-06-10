import { Module } from '@nestjs/common';
import { AUTHN_SESSION_PORT } from '~/domain/auth-v2/ports/authn-session.port';
import { RATE_LIMIT_STORAGE } from '~/domain/auth-v2/ports/rate-limit-storage.port';
import { RECOVERY_TOKEN_STORE } from '~/domain/auth-v2/ports/recovery-token-store.port';
import { TWO_FACTOR_REPOSITORY } from '~/domain/auth-v2/ports/two-factor.port';
import { OFFLINE_RECOVERY_CODE_REPOSITORY } from '~/domain/auth-v2/ports/offline-recovery-code.port';
import { RECOVERY_STRATEGY_REPOSITORY } from '~/domain/auth-v2/ports/recovery-strategy.port';
import { KNOWN_DEVICES_STORE } from '~/domain/auth-v2/ports/known-devices-store.port';
import { NEW_DEVICE_NOTIFICATION_THROTTLE } from '~/domain/auth-v2/ports/new-device-notification-throttle.port';
import { SESSION_METADATA_PORT } from '~/domain/auth-v2/ports/session-metadata.port';
import { VAULT_REPOSITORY } from '~/domain/auth-v2/vault/vault-repository.port';
import { RedisModule } from '~/infrastructure/redis/redis.module';
import { AuthentikSessionAdapter } from './authentik-session.adapter';
import { PostgresVaultRepository } from './postgres-vault.repository';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { RedisRecoveryTokenStore } from './redis-recovery-token.store';
import { PostgresTwoFactorRepository } from './postgres-two-factor.repository';
import { PostgresOfflineRecoveryCodeRepository } from './postgres-offline-recovery-code.repository';
import { PostgresRecoveryStrategyRepository } from './postgres-recovery-strategy.repository';
import { RedisKnownDevicesStore } from './redis-known-devices.store';
import { RedisNewDeviceNotificationThrottleStore } from './redis-new-device-notification-throttle.store';
import { RedisSessionMetadataStore } from './redis-session-metadata.store';

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
    { provide: KNOWN_DEVICES_STORE, useClass: RedisKnownDevicesStore },
    { provide: NEW_DEVICE_NOTIFICATION_THROTTLE, useClass: RedisNewDeviceNotificationThrottleStore },
    { provide: SESSION_METADATA_PORT, useClass: RedisSessionMetadataStore },
  ],
  exports: [AUTHN_SESSION_PORT, VAULT_REPOSITORY, RATE_LIMIT_STORAGE, RECOVERY_TOKEN_STORE, TWO_FACTOR_REPOSITORY, OFFLINE_RECOVERY_CODE_REPOSITORY, RECOVERY_STRATEGY_REPOSITORY, KNOWN_DEVICES_STORE, NEW_DEVICE_NOTIFICATION_THROTTLE, SESSION_METADATA_PORT],
})
export class AuthV2InfrastructureModule {}
