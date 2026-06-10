import { Module } from '@nestjs/common';
import { AUTHN_SESSION_PORT } from '~/domain/auth-v2/ports/authn-session.port';
import { AuthentikSessionAdapter } from './authentik-session.adapter';

/** Инфраструктурные адаптеры auth-v2 (CoopID): провайдер порта сессии IdP. */
@Module({
  providers: [{ provide: AUTHN_SESSION_PORT, useClass: AuthentikSessionAdapter }],
  exports: [AUTHN_SESSION_PORT],
})
export class AuthV2InfrastructureModule {}
