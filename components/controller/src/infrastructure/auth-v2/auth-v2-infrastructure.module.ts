import { Module } from '@nestjs/common';
import { AUTHN_SESSION_PORT } from '~/domain/auth-v2/ports/authn-session.port';
import { RATE_LIMIT_STORAGE } from '~/domain/auth-v2/ports/rate-limit-storage.port';
import { VAULT_REPOSITORY } from '~/domain/auth-v2/vault/vault-repository.port';
import { RedisModule } from '~/infrastructure/redis/redis.module';
import { AuthentikSessionAdapter } from './authentik-session.adapter';
import { PostgresVaultRepository } from './postgres-vault.repository';
import { RedisThrottlerStorage } from './redis-throttler.storage';

/** Инфраструктурные адаптеры auth-v2 (CoopID): порт сессии IdP + vault-репозиторий + rate-limit storage. */
@Module({
  imports: [RedisModule],
  providers: [
    { provide: AUTHN_SESSION_PORT, useClass: AuthentikSessionAdapter },
    { provide: VAULT_REPOSITORY, useClass: PostgresVaultRepository },
    { provide: RATE_LIMIT_STORAGE, useClass: RedisThrottlerStorage },
  ],
  exports: [AUTHN_SESSION_PORT, VAULT_REPOSITORY, RATE_LIMIT_STORAGE],
})
export class AuthV2InfrastructureModule {}
