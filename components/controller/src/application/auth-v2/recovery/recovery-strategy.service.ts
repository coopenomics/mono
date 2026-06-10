import { Inject, Injectable } from '@nestjs/common';
import { AuthV2Error, AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { RECOVERY_STRATEGY_REPOSITORY } from '~/domain/auth-v2/ports/recovery-strategy.port';
import type { IRecoveryStrategyRepository } from '~/domain/auth-v2/ports/recovery-strategy.port';
import { TWO_FACTOR_VERIFIER } from '~/domain/auth-v2/ports/two-factor.port';
import type { ITwoFactorVerifier } from '~/domain/auth-v2/ports/two-factor.port';
import { DEFAULT_RECOVERY_STRATEGY, RecoveryStrategy } from '~/domain/auth-v2/recovery-strategy/recovery-strategy.types';
import { SecurityEventKind } from '~/domain/auth-v2/security-events/security-event.types';
import { AuditService } from '../audit/audit.service';
import { SecurityEventNotificationService } from '../security-events/security-event-notification.service';

/**
 * Управление стратегией восстановления (CoopID, Story 3.5). Активна ровно одна
 * стратегия; она гейтит входные каналы recovery (3.1 email / 3.4 offline-код).
 * Смена — чувствительная операция: требует step-up второго фактора (TOTP), как
 * 2FA-disable (Story 3.6), + audit. См. отступление от AC (пароль→TOTP) в спеке.
 */
@Injectable()
export class RecoveryStrategyService {
  constructor(
    @Inject(RECOVERY_STRATEGY_REPOSITORY) private readonly repo: IRecoveryStrategyRepository,
    @Inject(TWO_FACTOR_VERIFIER) private readonly twoFactor: ITwoFactorVerifier,
    private readonly audit: AuditService,
    private readonly securityEvents: SecurityEventNotificationService,
  ) {}

  /** Текущая стратегия пайщика (дефолт — email magic-link, если не задавалась). */
  async getStrategy(subjectId: string): Promise<RecoveryStrategy> {
    return (await this.repo.get(subjectId)) ?? DEFAULT_RECOVERY_STRATEGY;
  }

  /**
   * Сменить стратегию: step-up TOTP → запись → audit. `strategy` уже провалидирован
   * контроллером (enum). Нет 2FA → TwoFactorNotEnrolled; неверный код → InvalidTwoFactorCode.
   */
  async setStrategy(
    subjectId: string,
    strategy: RecoveryStrategy,
    totpCode: string,
    ip: string | null,
  ): Promise<void> {
    const enabled = await this.twoFactor.isEnabled(subjectId);
    if (!enabled) {
      throw new AuthV2Error(
        AuthV2ErrorCode.TwoFactorNotEnrolled,
        'Смена способа восстановления требует кода из приложения-аутентификатора, но он не подключён.',
      );
    }
    const codeOk = await this.twoFactor.verify(subjectId, totpCode);
    if (!codeOk) {
      throw new AuthV2Error(AuthV2ErrorCode.InvalidTwoFactorCode, 'Неверный код из приложения-аутентификатора.');
    }

    await this.repo.set(subjectId, strategy);
    await this.audit.record({
      event: 'coopid.recovery.strategy_changed',
      subjectId,
      actor: 'self',
      result: 'success',
      context: { strategy },
      ip,
    });
    // Story 3.11: уведомить пайщика о смене способа восстановления (best-effort).
    await this.securityEvents.notify({ subjectId, kind: SecurityEventKind.RecoveryStrategyChanged, ip });
  }

  /** Активен ли канал восстановления `channel` у пайщика (для гейтинга 3.1/3.4). */
  async isChannelActive(subjectId: string, channel: RecoveryStrategy): Promise<boolean> {
    return (await this.getStrategy(subjectId)) === channel;
  }
}
