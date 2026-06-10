import { Inject, Injectable, Logger } from '@nestjs/common';
import { Workflows } from '@coopenomics/notifications';
import config from '~/config/config';
import { NOTIFICATION_PORT } from '~/domain/notification/interfaces/notify.port';
import type { NotificationPort } from '~/domain/notification/interfaces/notify.port';
import { USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import type { UserDomainService } from '~/domain/user/services/user-domain.service';
import { NEW_DEVICE_NOTIFICATION_THROTTLE } from '~/domain/auth-v2/ports/new-device-notification-throttle.port';
import type { INewDeviceNotificationThrottle } from '~/domain/auth-v2/ports/new-device-notification-throttle.port';

export interface NewDeviceNotificationInput {
  /** subject_id пайщика (user.id) — для резолва получателя и троттла. */
  subjectId: string;
  /** username — на случай отсутствия записи пользователя (диагностика). */
  username: string;
  ip: string | null;
  userAgent: string | null;
}

/**
 * Уведомление о входе с нового устройства (CoopID, Story 3.9).
 *
 * Триггерится из {@link DeviceTrackingService} при `isNewDevice`. Ставит в очередь
 * Центра уведомлений сообщение «Новый вход: устройство, IP, время» через workflow
 * `new-device-login` (email + in-app). Bundling NFR10 — не более 1 уведомления в
 * 12-часовое окно на пайщика (порт {@link INewDeviceNotificationThrottle}).
 *
 * Всё best-effort: любая ошибка (троттл/резолв/notify) логируется и проглатывается —
 * уведомление не должно валить успешный вход (как device tracking в 3.8).
 *
 * Ссылка «это не я» ведёт на страницу безопасности ЛК; выделенный one-click endpoint
 * массового отзыва сессий — Story 3.10 (тогда `securityUrl` станет deep-link).
 */
@Injectable()
export class NewDeviceNotificationService {
  private readonly logger = new Logger(NewDeviceNotificationService.name);

  constructor(
    @Inject(NOTIFICATION_PORT) private readonly notifications: NotificationPort,
    @Inject(USER_DOMAIN_SERVICE) private readonly users: UserDomainService,
    @Inject(NEW_DEVICE_NOTIFICATION_THROTTLE)
    private readonly throttle: INewDeviceNotificationThrottle,
  ) {}

  /**
   * Отправляет уведомление о новом устройстве, если позволяет bundling-окно.
   * Никогда не бросает — вход не должен зависеть от доставки уведомления.
   */
  async maybeNotify(input: NewDeviceNotificationInput): Promise<void> {
    try {
      // Bundling NFR10: занимаем 12ч-окно ДО отправки (атомарно, защита от гонки).
      const acquired = await this.throttle.tryAcquire(input.subjectId);
      if (!acquired) {
        return;
      }

      const user = await this.users.findUserById(input.subjectId);
      // Без subscriber_id Центр уведомлений не может адресовать получателя — пропускаем.
      if (!user || !user.subscriber_id) {
        this.logger.warn(`new-device уведомление пропущено: нет получателя для ${input.subjectId}`);
        return;
      }

      await this.notifications.notify({
        coopname: config.coopname,
        workflowId: Workflows.NewDeviceLogin.id,
        to: {
          subscriberId: user.subscriber_id,
          // Email — только подтверждённый (gate email-канала); in-app идёт по subscriber_id.
          email: user.is_email_verified ? user.email : undefined,
          username: user.username,
        },
        payload: {
          device: input.userAgent ?? 'неизвестное устройство',
          ip: input.ip ?? 'неизвестен',
          time: new Date().toISOString(),
          securityUrl: `${config.frontend_url}/settings/security`,
        },
      });
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      this.logger.warn(`new-device уведомление не отправлено для ${input.username}: ${reason}`);
    }
  }
}
