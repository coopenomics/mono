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
import { CertKeyService } from './certificate/cert-key.service';
import { EndorsementService } from './certificate/endorsement.service';
import { AccountInfrastructureModule } from '~/infrastructure/account/account-infrastructure.module';
import { VaultDomainModule } from '~/domain/vault/vault-domain.module';
import { CertificateResolver } from './certificate/certificate.resolver';
import { CoopIdClaimsPolicyController } from './certificate/coopid-claims-policy.controller';
import { CoopIdSchemaPolicyController } from './certificate/coopid-schema-policy.controller';
import { AuthorizationModule } from './authorization/authorization.module';
import { AuthMetricsModule } from './metrics/auth-metrics.module';
import { VerificationTypesService } from './verification/verification-types.service';
import { VerificationRulesService } from './verification/verification-rules.service';
import { VerificationRuleGuard } from './verification/verification-rule.guard';
import { BaselineVerificationResolver } from './verification/resolvers/baseline-verification.resolver';
import { ChainVerificationResolver } from './verification/resolvers/chain-verification.resolver';
import { VerificationOnsiteService } from './verification/verification-onsite.service';
import { VerificationAuthorityService } from './verification/verification-authority.service';
import { VerificationIdentityService } from './verification/verification-identity.service';
import { VerificationReviewService } from './verification/verification-review.service';
import { bucketProvidersFor } from '@coopenomics/extension-kit';
import { FILE_STORAGE_PORT } from '@coopenomics/innercoop';
import { VerificationResolver } from './verification/verification.resolver';
import { VERIFICATION_SOURCE_RESOLVERS } from '~/domain/auth-v2/ports/verification-source.port';
import { LogoutService } from './logout/logout.service';
import { LogoutController } from './logout/logout.controller';
import { AuthRateLimitGuard } from './rate-limit/auth-rate-limit.guard';
import { RecoveryService } from './recovery/recovery.service';
import { RecoveryConfirmService } from './recovery/recovery-confirm.service';
import { OfflineRecoveryService } from './recovery/offline-recovery.service';
import { RecoveryStrategyService } from './recovery/recovery-strategy.service';
import { RecoveryFinalizationService } from './recovery/recovery-finalization.service';
import { RecoveryController } from './recovery/recovery.controller';
import { RefreshService } from './refresh/refresh.service';
import { RefreshController } from './refresh/refresh.controller';
import { MigrationService } from './migration/migration.service';
import { MigrationController } from './migration/migration.controller';
import { TwoFactorService } from './two-factor/two-factor.service';
import { SessionsService } from './sessions/sessions.service';
import { SecurityIncidentService } from './security/security-incident.service';
import { SecurityIncidentController } from './security/security-incident.controller';
import { CriticalActionsService } from './critical-actions/critical-actions.service';
import { ForceRecoveryService } from './force-recovery/force-recovery.service';
import { ForceRecoveryController } from './force-recovery/force-recovery.controller';
import { KeyRevocationService } from './key-revocation/key-revocation.service';
import { CapabilitySetService } from './authorization/capability-set.service';
import { AuthorizationResolver } from './authorization/authorization.resolver';
import { AccountSecurityResolver } from './account-security/account-security.resolver';
import { SessionIssueService } from './verify-timestamp/session-issue.service';
import { LoginTwoFactorService } from './login-2fa/login-two-factor.service';
import { LoginFactorsService } from './login-2fa/login-factors.service';
import { LoginTwoFactorController } from './login-2fa/login-two-factor.controller';
import { CriticalActionsResolver } from './critical-actions/critical-actions.resolver';

/**
 * auth-v2 (CoopID): новый контур аутентификации. Живёт рядом с legacy `auth/`
 * до Phase 3 миграции (Эпик 7). Здесь: аудит, приёмник событий authentik,
 * session_binding_token-мост, vault-хранилище и второй этап (timestamp-verify);
 * certificate/id_token — Story 1.8. BLOCKCHAIN_PORT/USER_DOMAIN_SERVICE — @Global.
 */
@Module({
  imports: [RedisModule, AuthV2InfrastructureModule, TokenApplicationModule, AuthorizationModule, AuthMetricsModule, VaultDomainModule, AccountInfrastructureModule],
  // SecurityIncidentController/ForceRecoveryController остаются REST только ради magic-link
  // `:token`-эндпоинтов (клик из письма без SDK-контекста); их JWT-методы переведены в
  // GraphQL/SDK (AccountSecurityResolver/CriticalActionsResolver, Фаза 2 миграции).
  controllers: [AuthentikEventsController, SessionBindingController, VaultController, VerifyTimestampController, CoopIdClaimsPolicyController, CoopIdSchemaPolicyController, LogoutController, RefreshController, RecoveryController, MigrationController, SecurityIncidentController, ForceRecoveryController, LoginTwoFactorController],
  providers: [
    // Снимки сверки личности (coopid:verification) — бакет по @UseBucket.
    ...bucketProvidersFor(FILE_STORAGE_PORT, [VerificationReviewService]),
    AuditService, AuditActionInterceptor, SessionBindingService, VaultService, VerifyTimestampService, SessionIssueService, LoginTwoFactorService, LoginFactorsService, CertificateService, CertSettingsService, CertKeyService, EndorsementService, BaselineVerificationResolver, ChainVerificationResolver, VerificationTypesService, VerificationRulesService, VerificationRuleGuard, VerificationOnsiteService, VerificationAuthorityService, VerificationIdentityService, VerificationReviewService, VerificationResolver, LogoutService, RefreshService, MigrationService, AuthRateLimitGuard, RecoveryService, RecoveryConfirmService, OfflineRecoveryService, RecoveryStrategyService, RecoveryFinalizationService, TwoFactorService, DeviceTrackingService, NewDeviceNotificationService, SecurityEventNotificationService, SessionsService, SecurityIncidentService, CriticalActionsService, ForceRecoveryService, KeyRevocationService, CapabilitySetService, AuthorizationResolver, CertificateResolver, AccountSecurityResolver, CriticalActionsResolver,
    // Узкий verifier-порт для потребителей (recovery Story 3.2, 2FA-вход) → тот же сервис.
    { provide: TWO_FACTOR_VERIFIER, useExisting: TwoFactorService },
    // Финализация recovery (Story 3.3): ротация ключа через registrator::changekey + vault + отзыв сессий + аудит.
    { provide: RECOVERY_FINALIZATION_PORT, useExisting: RecoveryFinalizationService },
    // Источники уровней верификации (фабрика): новый уровень = новый резолвер в этом наборе.
    {
      provide: VERIFICATION_SOURCE_RESOLVERS,
      useFactory: (baseline: BaselineVerificationResolver, chain: ChainVerificationResolver) => [baseline, chain],
      inject: [BaselineVerificationResolver, ChainVerificationResolver],
    },
  ],
  exports: [AuditService, SessionBindingService, VaultService, VerifyTimestampService, LoginTwoFactorService, CertificateService, CertKeyService, VerificationTypesService, VerificationRulesService, VerificationRuleGuard, LogoutService, TwoFactorService, TWO_FACTOR_VERIFIER],
})
export class AuthV2Module {}
