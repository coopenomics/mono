import { Module } from '@nestjs/common';
import { RedisModule } from '~/infrastructure/redis/redis.module';
import { AuthV2InfrastructureModule } from '~/infrastructure/auth-v2/auth-v2-infrastructure.module';
import { TokenApplicationModule } from '~/application/token/token-application.module';
import { TWO_FACTOR_VERIFIER } from '~/domain/auth-v2/ports/two-factor.port';
import { RECOVERY_FINALIZATION_PORT } from '~/domain/auth-v2/ports/recovery-finalization.port';
import { AuditService } from './audit/audit.service';
import { AuditActionInterceptor } from './audit/audit-action.interceptor';
import { AuthentikEventsController } from './authentik-events.controller';
import { SessionBindingService } from './session-binding/session-binding.service';
import { SessionBindingController } from './session-binding/session-binding.controller';
import { VaultService } from './vault/vault.service';
import { VaultController } from './vault/vault.controller';
import { VerifyTimestampService } from './verify-timestamp/verify-timestamp.service';
import { VerifyTimestampController } from './verify-timestamp/verify-timestamp.controller';
import { DeviceTrackingService } from './device-tracking/device-tracking.service';
import { NewDeviceNotificationService } from './device-tracking/new-device-notification.service';
import { SecurityEventNotificationService } from './security-events/security-event-notification.service';
import { CertificateService } from './certificate/certificate.service';
import { CertSettingsService } from './certificate/cert-settings.service';
import { CertificateController } from './certificate/certificate.controller';
import { CoopIdClaimsPolicyController } from './certificate/coopid-claims-policy.controller';
import { CoopIdSchemaPolicyController } from './certificate/coopid-schema-policy.controller';
import { AuthorizationModule } from './authorization/authorization.module';
import { VerificationTypesService } from './verification/verification-types.service';
import { VerificationRulesService } from './verification/verification-rules.service';
import { VerificationRuleGuard } from './verification/verification-rule.guard';
import { LogoutService } from './logout/logout.service';
import { LogoutController } from './logout/logout.controller';
import { AuthRateLimitGuard } from './rate-limit/auth-rate-limit.guard';
import { RecoveryService } from './recovery/recovery.service';
import { RecoveryConfirmService } from './recovery/recovery-confirm.service';
import { OfflineRecoveryService } from './recovery/offline-recovery.service';
import { RecoveryStrategyService } from './recovery/recovery-strategy.service';
import { RecoveryStrategyController } from './recovery/recovery-strategy.controller';
import { RecoveryFinalizationService } from './recovery/recovery-finalization.service';
import { RecoveryController } from './recovery/recovery.controller';
import { TwoFactorService } from './two-factor/two-factor.service';
import { TwoFactorController } from './two-factor/two-factor.controller';
import { SessionsService } from './sessions/sessions.service';
import { SessionsController } from './sessions/sessions.controller';
import { SecurityIncidentService } from './security/security-incident.service';
import { SecurityIncidentController } from './security/security-incident.controller';
import { CriticalActionsService } from './critical-actions/critical-actions.service';
import { CriticalActionsController } from './critical-actions/critical-actions.controller';
import { ForceRecoveryService } from './force-recovery/force-recovery.service';
import { ForceRecoveryController } from './force-recovery/force-recovery.controller';
import { KeyRevocationService } from './key-revocation/key-revocation.service';
import { KeyRevocationController } from './key-revocation/key-revocation.controller';
import { CapabilitySetService } from './authorization/capability-set.service';
import { CapabilitySetController } from './authorization/capability-set.controller';

/**
 * auth-v2 (CoopID): новый контур аутентификации. Живёт рядом с legacy `auth/`
 * до Phase 3 миграции (Эпик 7). Здесь: аудит, приёмник событий authentik,
 * session_binding_token-мост, vault-хранилище и второй этап (timestamp-verify);
 * certificate/id_token — Story 1.8. BLOCKCHAIN_PORT/USER_DOMAIN_SERVICE — @Global.
 */
@Module({
  imports: [RedisModule, AuthV2InfrastructureModule, TokenApplicationModule, AuthorizationModule],
  controllers: [AuthentikEventsController, SessionBindingController, VaultController, VerifyTimestampController, CertificateController, CoopIdClaimsPolicyController, CoopIdSchemaPolicyController, LogoutController, RecoveryController, RecoveryStrategyController, TwoFactorController, SessionsController, SecurityIncidentController, CriticalActionsController, ForceRecoveryController, KeyRevocationController, CapabilitySetController],
  providers: [
    AuditService, AuditActionInterceptor, SessionBindingService, VaultService, VerifyTimestampService, CertificateService, CertSettingsService, VerificationTypesService, VerificationRulesService, VerificationRuleGuard, LogoutService, AuthRateLimitGuard, RecoveryService, RecoveryConfirmService, OfflineRecoveryService, RecoveryStrategyService, RecoveryFinalizationService, TwoFactorService, DeviceTrackingService, NewDeviceNotificationService, SecurityEventNotificationService, SessionsService, SecurityIncidentService, CriticalActionsService, ForceRecoveryService, KeyRevocationService, CapabilitySetService,
    // Узкий verifier-порт для потребителей (recovery Story 3.2, 2FA-вход) → тот же сервис.
    { provide: TWO_FACTOR_VERIFIER, useExisting: TwoFactorService },
    // Финализация recovery (Story 3.3): ротация ключа через registrator::changekey + vault + отзыв сессий + аудит.
    { provide: RECOVERY_FINALIZATION_PORT, useExisting: RecoveryFinalizationService },
  ],
  exports: [AuditService, SessionBindingService, VaultService, VerifyTimestampService, CertificateService, VerificationTypesService, VerificationRulesService, VerificationRuleGuard, LogoutService, TwoFactorService, TWO_FACTOR_VERIFIER],
})
export class AuthV2Module {}
