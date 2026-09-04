import { Inject, Injectable } from '@nestjs/common';
import config from '~/config/config';
import { encrypt, decrypt } from '~/utils/aes';
import { AuthV2Error, AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { TWO_FACTOR_REPOSITORY } from '~/domain/auth-v2/ports/two-factor.port';
import type { ITwoFactorRepository, ITwoFactorVerifier } from '~/domain/auth-v2/ports/two-factor.port';
import { buildOtpauthUri, generateTotpSecret, verifyTotp } from '~/domain/auth-v2/totp/totp';
import { SecurityEventKind } from '~/domain/auth-v2/security-events/security-event.types';
import { AuditService } from '../audit/audit.service';
import { SecurityEventNotificationService } from '../security-events/security-event-notification.service';

export interface EnrollmentChallenge {
  /** Base32-секрет для ручного ввода в приложение-аутентификатор. */
  secret: string;
  /** otpauth://-URI для QR-кода. */
  otpauthUri: string;
}

/**
 * Второй фактор TOTP (Google Authenticator) — CoopID Story 3.6. Управляет
 * enrollment/disable и реализует {@link ITwoFactorVerifier} для потребителей
 * (recovery — Story 3.2, 2FA-вход). Секрет хранится зашифрованным server-key.
 */
@Injectable()
export class TwoFactorService implements ITwoFactorVerifier {
  constructor(
    @Inject(TWO_FACTOR_REPOSITORY) private readonly repo: ITwoFactorRepository,
    private readonly audit: AuditService,
    private readonly securityEvents: SecurityEventNotificationService,
  ) {}

  /**
   * Начать подключение: выпустить секрет (в состоянии «ожидает подтверждения») и
   * отдать challenge для QR. Активируется только после `activate()` с первым кодом.
   */
  async beginEnrollment(subjectId: string, accountLabel: string): Promise<EnrollmentChallenge> {
    const secret = generateTotpSecret();
    await this.repo.putPending(subjectId, encrypt(secret));
    return { secret, otpauthUri: buildOtpauthUri(secret, accountLabel, config.coopname) };
  }

  /** Подтвердить enrollment первым кодом из приложения. */
  async activate(subjectId: string, code: string, ip: string | null): Promise<void> {
    const record = await this.repo.get(subjectId);
    if (!record) throw new AuthV2Error(AuthV2ErrorCode.TwoFactorNotEnrolled, 'Второй фактор не выпущен — начните подключение заново.');
    if (!verifyTotp(decrypt(record.secretEnc), code)) {
      throw new AuthV2Error(AuthV2ErrorCode.InvalidTwoFactorCode, 'Неверный код из приложения-аутентификатора.');
    }
    await this.repo.enable(subjectId);
    await this.audit.record({ event: 'coopid.2fa.enabled', subjectId, actor: 'self', result: 'success', ip });
    // Story 3.11: уведомить пайщика о подключении 2FA (best-effort).
    await this.securityEvents.notify({ subjectId, kind: SecurityEventKind.TwoFactorEnabled, ip });
  }

  /** Отключить второй фактор — требует валидный код (защита от отключения без устройства). */
  async disable(subjectId: string, code: string, ip: string | null): Promise<void> {
    const record = await this.repo.get(subjectId);
    if (!record || !record.enabled) {
      throw new AuthV2Error(AuthV2ErrorCode.TwoFactorNotEnrolled, 'Второй фактор не подключён.');
    }
    if (!verifyTotp(decrypt(record.secretEnc), code)) {
      throw new AuthV2Error(AuthV2ErrorCode.InvalidTwoFactorCode, 'Неверный код из приложения-аутентификатора.');
    }
    await this.repo.remove(subjectId);
    await this.audit.record({ event: 'coopid.2fa.disabled', subjectId, actor: 'self', result: 'success', ip });
    // Story 3.11: уведомить пайщика об отключении 2FA (best-effort).
    await this.securityEvents.notify({ subjectId, kind: SecurityEventKind.TwoFactorDisabled, ip });
  }

  /**
   * Снять приложение-аутентификатор председателем — без кода.
   *
   * Пайщик теряет телефон, а вместе с ним и единственный источник кода: сам он
   * отключить фактор уже не может (`disable` требует действующий код), и вход в
   * кабинет для него закрыт. Владелец 04.09.2026: сброс делает председатель из
   * реестра пайщиков — там же, где он подтверждает личность.
   *
   * Действие идёт в аудит как chairman-действие и уведомляет пайщика тем же
   * событием, что и самостоятельное отключение: он обязан узнать, что защиту с
   * его аккаунта сняли, даже если просил об этом не он.
   *
   * @returns было ли что сбрасывать (false — приложение и так не подключено).
   */
  async resetByChairman(subjectId: string, chairmanUsername: string, ip: string | null): Promise<boolean> {
    const record = await this.repo.get(subjectId);
    if (!record) return false;

    await this.repo.remove(subjectId);
    await this.audit.record({
      event: 'coopid.2fa.disabled',
      subjectId,
      actor: chairmanUsername,
      result: 'success',
      context: { reason: 'chairman_reset' },
      ip,
    });
    await this.securityEvents.notify({ subjectId, kind: SecurityEventKind.TwoFactorDisabled, ip });
    return true;
  }

  async isEnabled(subjectId: string): Promise<boolean> {
    const record = await this.repo.get(subjectId);
    return record?.enabled ?? false;
  }

  async verify(subjectId: string, code: string): Promise<boolean> {
    const record = await this.repo.get(subjectId);
    if (!record || !record.enabled) return false;
    return verifyTotp(decrypt(record.secretEnc), code);
  }
}
