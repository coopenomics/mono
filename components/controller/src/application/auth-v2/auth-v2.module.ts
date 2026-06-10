import { Module } from '@nestjs/common';
import { AuditService } from './audit/audit.service';
import { AuthentikEventsController } from './authentik-events.controller';

/**
 * auth-v2 (CoopID): новый контур аутентификации. Живёт рядом с legacy `auth/`
 * до Phase 3 миграции (Эпик 7). Здесь: аудит в coop_domain_db и internal-приёмник
 * событий authentik; OIDC-эндпоинты приходят в Stories 1.7–1.8.
 */
@Module({
  controllers: [AuthentikEventsController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuthV2Module {}
