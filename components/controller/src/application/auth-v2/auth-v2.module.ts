import { Module } from '@nestjs/common';
import { RedisModule } from '~/infrastructure/redis/redis.module';
import { AuthV2InfrastructureModule } from '~/infrastructure/auth-v2/auth-v2-infrastructure.module';
import { AuditService } from './audit/audit.service';
import { AuthentikEventsController } from './authentik-events.controller';
import { SessionBindingService } from './session-binding/session-binding.service';
import { SessionBindingController } from './session-binding/session-binding.controller';

/**
 * auth-v2 (CoopID): новый контур аутентификации. Живёт рядом с legacy `auth/`
 * до Phase 3 миграции (Эпик 7). Здесь: аудит в coop_domain_db, internal-приёмник
 * событий authentik и session_binding_token-мост; timestamp-verify/certificate — 1.7–1.8.
 */
@Module({
  imports: [RedisModule, AuthV2InfrastructureModule],
  controllers: [AuthentikEventsController, SessionBindingController],
  providers: [AuditService, SessionBindingService],
  exports: [AuditService, SessionBindingService],
})
export class AuthV2Module {}
