import { Module } from '@nestjs/common';
import { RedisModule } from '~/infrastructure/redis/redis.module';
import { AuthV2InfrastructureModule } from '~/infrastructure/auth-v2/auth-v2-infrastructure.module';
import { AuditService } from './audit/audit.service';
import { AuthentikEventsController } from './authentik-events.controller';
import { SessionBindingService } from './session-binding/session-binding.service';
import { SessionBindingController } from './session-binding/session-binding.controller';
import { VaultService } from './vault/vault.service';
import { VaultController } from './vault/vault.controller';

/**
 * auth-v2 (CoopID): новый контур аутентификации. Живёт рядом с legacy `auth/`
 * до Phase 3 миграции (Эпик 7). Здесь: аудит, приёмник событий authentik,
 * session_binding_token-мост и vault-хранилище; timestamp-verify/certificate — 1.7–1.8.
 */
@Module({
  imports: [RedisModule, AuthV2InfrastructureModule],
  controllers: [AuthentikEventsController, SessionBindingController, VaultController],
  providers: [AuditService, SessionBindingService, VaultService],
  exports: [AuditService, SessionBindingService, VaultService],
})
export class AuthV2Module {}
