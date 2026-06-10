import { Module } from '@nestjs/common';
import { RedisModule } from '~/infrastructure/redis/redis.module';
import { AuthV2InfrastructureModule } from '~/infrastructure/auth-v2/auth-v2-infrastructure.module';
import { TokenApplicationModule } from '~/application/token/token-application.module';
import { AuditService } from './audit/audit.service';
import { AuthentikEventsController } from './authentik-events.controller';
import { SessionBindingService } from './session-binding/session-binding.service';
import { SessionBindingController } from './session-binding/session-binding.controller';
import { VaultService } from './vault/vault.service';
import { VaultController } from './vault/vault.controller';
import { VerifyTimestampService } from './verify-timestamp/verify-timestamp.service';
import { VerifyTimestampController } from './verify-timestamp/verify-timestamp.controller';
import { CertificateService } from './certificate/certificate.service';
import { CertificateController } from './certificate/certificate.controller';
import { LogoutService } from './logout/logout.service';
import { LogoutController } from './logout/logout.controller';
import { AuthRateLimitGuard } from './rate-limit/auth-rate-limit.guard';
import { RecoveryService } from './recovery/recovery.service';
import { RecoveryController } from './recovery/recovery.controller';

/**
 * auth-v2 (CoopID): новый контур аутентификации. Живёт рядом с legacy `auth/`
 * до Phase 3 миграции (Эпик 7). Здесь: аудит, приёмник событий authentik,
 * session_binding_token-мост, vault-хранилище и второй этап (timestamp-verify);
 * certificate/id_token — Story 1.8. BLOCKCHAIN_PORT/USER_DOMAIN_SERVICE — @Global.
 */
@Module({
  imports: [RedisModule, AuthV2InfrastructureModule, TokenApplicationModule],
  controllers: [AuthentikEventsController, SessionBindingController, VaultController, VerifyTimestampController, CertificateController, LogoutController, RecoveryController],
  providers: [AuditService, SessionBindingService, VaultService, VerifyTimestampService, CertificateService, LogoutService, AuthRateLimitGuard, RecoveryService],
  exports: [AuditService, SessionBindingService, VaultService, VerifyTimestampService, CertificateService, LogoutService],
})
export class AuthV2Module {}
