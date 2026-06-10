import { Module } from '@nestjs/common';
import { AUTHN_SESSION_PORT } from '~/domain/auth-v2/ports/authn-session.port';
import { VAULT_REPOSITORY } from '~/domain/auth-v2/vault/vault-repository.port';
import { AuthentikSessionAdapter } from './authentik-session.adapter';
import { PostgresVaultRepository } from './postgres-vault.repository';

/** Инфраструктурные адаптеры auth-v2 (CoopID): порт сессии IdP + vault-репозиторий. */
@Module({
  providers: [
    { provide: AUTHN_SESSION_PORT, useClass: AuthentikSessionAdapter },
    { provide: VAULT_REPOSITORY, useClass: PostgresVaultRepository },
  ],
  exports: [AUTHN_SESSION_PORT, VAULT_REPOSITORY],
})
export class AuthV2InfrastructureModule {}
