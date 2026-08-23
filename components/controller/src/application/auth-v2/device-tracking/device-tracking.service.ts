import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { KNOWN_DEVICES_STORE } from '~/domain/auth-v2/ports/known-devices-store.port';
import type { IKnownDevicesStore } from '~/domain/auth-v2/ports/known-devices-store.port';
import { AuditService } from '../audit/audit.service';
import { NewDeviceNotificationService } from './new-device-notification.service';

export interface RecordLoginInput {
  /** subject_id пайщика (user.id) — ключ множества устройств и audit. */
  subjectId: string;
  /** username (аккаунт) — actor в audit. */
  username: string;
  ip: string | null;
  userAgent: string | null;
  acceptLanguage: string | null;
}

export interface RecordLoginResult {
  /** Устройство не встречалось ранее — сигнал для уведомления (Story 3.9). */
  isNewDevice: boolean;
  fingerprint: string;
}

/**
 * Device tracking при входе (CoopID, Story 3.8). На успешном входе фиксирует
 * устройство: audit-событие `coopid.login.successful` + обновление Redis-списка
 * известных устройств. Возвращает признак нового устройства — основу детекции
 * незнакомого входа (Story 3.9).
 *
 * Fingerprint — server-side: `sha256(user_agent + '\n' + accept_language)`.
 * Screen-resolution из AC отложен (клиентский сигнал, нет в контракте входа) —
 * см. отступление в спеке Story 3.8.
 */
@Injectable()
export class DeviceTrackingService {
  constructor(
    @Inject(KNOWN_DEVICES_STORE) private readonly devices: IKnownDevicesStore,
    private readonly audit: AuditService,
    private readonly newDeviceNotifier: NewDeviceNotificationService,
  ) {}

  /** Стабильный идентификатор устройства по серверным заголовкам запроса. */
  computeFingerprint(userAgent: string | null, acceptLanguage: string | null): string {
    return createHash('sha256').update(`${userAgent ?? ''}\n${acceptLanguage ?? ''}`).digest('hex');
  }

  async recordLogin(input: RecordLoginInput): Promise<RecordLoginResult> {
    const fingerprint = this.computeFingerprint(input.userAgent, input.acceptLanguage);

    const known = await this.devices.isKnown(input.subjectId, fingerprint);
    await this.devices.remember(input.subjectId, fingerprint, { ip: input.ip, userAgent: input.userAgent });

    await this.audit.record({
      event: 'coopid.login.successful',
      subjectId: input.subjectId,
      actor: input.username,
      result: 'success',
      ip: input.ip,
      userAgent: input.userAgent,
      context: {
        device_new: !known,
        accept_language: input.acceptLanguage,
      },
    });

    // Новое устройство — уведомляем пайщика (Story 3.9). Сервис best-effort:
    // не бросает, bundling-окно 12ч внутри. Вход не зависит от доставки.
    if (!known) {
      await this.newDeviceNotifier.maybeNotify({
        subjectId: input.subjectId,
        username: input.username,
        ip: input.ip,
        userAgent: input.userAgent,
      });
    }

    return { isNewDevice: !known, fingerprint };
  }
}
