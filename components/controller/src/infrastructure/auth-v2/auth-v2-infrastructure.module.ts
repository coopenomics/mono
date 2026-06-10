import { Module } from '@nestjs/common';
import { AUTHN_SESSION_PORT } from '~/domain/auth-v2/ports/authn-session.port';
import { RATE_LIMIT_STORAGE } from '~/domain/auth-v2/ports/rate-limit-storage.port';
import { RECOVERY_TOKEN_STORE } from '~/domain/auth-v2/ports/recovery-token-store.port';
import { VAULT_REPOSITORY } from '~/domain/auth-v2/vault/vault-repository.port';
import { RedisModule } from '~/infrastructure/redis/redis.module';
import { AuthentikSessionAdapter } from './authentik-session.adapter';
import { PostgresVaultRepository } from './postgres-vault.repository';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { RedisRecoveryTokenStore } from './redis-recovery-token.store';

/** Инфраструктурные адаптеры auth-v2 (CoopID): порт сессии IdP + vault-репозиторий + rate-limit storage + recovery-token store. */
@Module({
  imports: [RedisModule],
  providers: [
    { provide: AUTHN_SESSION_PORT, useClass: AuthentikSessionAdapter },
    { provide: VAULT_REPOSITORY, useClass: PostgresVaultRepository },
    { provide: RATE_LIMIT_STORAGE, useClass: RedisThrottlerStorage },
    { provide: RECOVERY_TOKEN_STORE, useClass: RedisRecoveryTokenStore },
  ],
  exports: [AUTHN_SESSION_PORT, VAULT_REPOSITORY, RATE_LIMIT_STORAGE, RECOVERY_TOKEN_STORE],
})
export class AuthV2InfrastructureModule {}
