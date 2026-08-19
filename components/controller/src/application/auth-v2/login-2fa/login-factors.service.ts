import { Inject, Injectable } from '@nestjs/common';
import { USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import type { UserDomainService } from '~/domain/user/services/user-domain.service';
import { AuthV2Error, AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { LOGIN_FACTORS_REPOSITORY } from '~/domain/auth-v2/ports/login-factors.port';
import type { ILoginFactorsRepository } from '~/domain/auth-v2/ports/login-factors.port';
import { TWO_FACTOR_VERIFIER } from '~/domain/auth-v2/ports/two-factor.port';
import type { ITwoFactorVerifier } from '~/domain/auth-v2/ports/two-factor.port';
import { SecurityEventKind } from '~/domain/auth-v2/security-events/security-event.types';
import { AuditService } from '../audit/audit.service';
import { SecurityEventNotificationService } from '../security-events/security-event-notification.service';

export interface LoginFactorsView {
  /** TOTP-секрет подключён (enrollment подтверждён) — фактор можно включить. */
  totp_enrolled: boolean;
  /** Требовать код из приложения при входе. */
  totp_enabled: boolean;
  /** Почта подтверждена — email-фактор можно включить. */
  email_available: boolean;
  /** Требовать код на почту при входе. */
  email_enabled: boolean;
}

export interface SetLoginFactorsInput {
  totp_enabled: boolean;
  email_enabled: boolean;
  /** TOTP-код — обязателен при любом изменении TOTP-фактора (step-up). */
  code?: string | null;
}

/**
 * Настройки второго фактора входа (самообслуживание, страница безопасности).
 *
 * Изменение TOTP-фактора (в обе стороны) требует действующий код из приложения:
 * угнанная сессия не должна ни отключить защиту, ни навесить чужой фактор.
 * Email-фактор управляется сессией (сам код при входе всё равно приходит только
 * на подтверждённую почту владельца). Любое изменение — аудит + уведомление
 * безопасности (Story 3.11): пайщик заметит чужую руку.
 */
@Injectable()
export class LoginFactorsService {
  constructor(
    @Inject(LOGIN_FACTORS_REPOSITORY) private readonly repo: ILoginFactorsRepository,
    @Inject(TWO_FACTOR_VERIFIER) private readonly twoFactor: ITwoFactorVerifier,
    @Inject(USER_DOMAIN_SERVICE) private readonly users: UserDomainService,
    private readonly audit: AuditService,
    private readonly securityEvents: SecurityEventNotificationService,
  ) {}

  async get(subjectId: string): Promise<LoginFactorsView> {
    const [record, enrolled, user] = await Promise.all([
      this.repo.get(subjectId),
      this.twoFactor.isEnabled(subjectId),
      this.users.findUserById(subjectId),
    ]);
    return {
      totp_enrolled: enrolled,
      totp_enabled: record?.totpEnabled ?? false,
      email_available: !!user?.is_email_verified,
      email_enabled: record?.emailEnabled ?? false,
    };
  }

  async set(subjectId: string, input: SetLoginFactorsInput, ip: string | null): Promise<LoginFactorsView> {
    const current = await this.repo.get(subjectId);
    const totpChanged = (current?.totpEnabled ?? false) !== input.totp_enabled;

    if (totpChanged) {
      const enrolled = await this.twoFactor.isEnabled(subjectId);
      if (!enrolled) {
        throw new AuthV2Error(
          AuthV2ErrorCode.TwoFactorNotEnrolled,
          'Сначала подключите приложение-аутентификатор.',
        );
      }
      if (!input.code || !(await this.twoFactor.verify(subjectId, input.code.trim()))) {
        throw new AuthV2Error(AuthV2ErrorCode.InvalidTwoFactorCode, 'Неверный код из приложения-аутентификатора.');
      }
    }

    if (input.email_enabled) {
      const user = await this.users.findUserById(subjectId);
      if (!user?.is_email_verified) {
        throw new AuthV2Error(
          AuthV2ErrorCode.InvalidCredentials,
          'Почта не подтверждена — код на неё отправлять нельзя.',
        );
      }
    }

    await this.repo.set({ subjectId, totpEnabled: input.totp_enabled, emailEnabled: input.email_enabled });

    const emailChanged = (current?.emailEnabled ?? false) !== input.email_enabled;
    if (totpChanged || emailChanged) {
      await this.audit.record({
        event: 'coopid.login_factors.changed',
        subjectId,
        actor: 'self',
        result: 'success',
        context: { totp_enabled: input.totp_enabled, email_enabled: input.email_enabled },
        ip,
      });
      // best-effort (notify сам глотает ошибки): пайщик должен заметить чужое изменение.
      await this.securityEvents.notify({ subjectId, kind: SecurityEventKind.LoginFactorsChanged, ip });
    }

    return this.get(subjectId);
  }

  /**
   * Приложение-аутентификатор отключено целиком (`disableTwoFactor`) — гасим
   * TOTP-фактор входа: настройка без секрета мертва (effectiveFactors её и так
   * пропустит), а «включённый» тумблер без работающего кода путал бы пайщика.
   */
  async onTotpUnenrolled(subjectId: string): Promise<void> {
    const current = await this.repo.get(subjectId);
    if (current?.totpEnabled) {
      await this.repo.set({ ...current, totpEnabled: false });
    }
  }
}
