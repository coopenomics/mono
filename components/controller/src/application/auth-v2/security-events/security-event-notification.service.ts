import { Inject, Injectable, Logger } from '@nestjs/common';
import { Workflows } from '@coopenomics/notifications';
import config from '~/config/config';
import { NOTIFICATION_PORT } from '@coopenomics/innercoop';
import type { INotificationPort } from '@coopenomics/innercoop';
import { USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import type { UserDomainService } from '~/domain/user/services/user-domain.service';
import {
  SECURITY_EVENT_TITLES,
  SecurityEventKind,
} from '~/domain/auth-v2/security-events/security-event.types';
import { isPrivateIp } from '../device-tracking/device-description.util';

/**
 * IP для письма человеческим языком: IPv4-in-IPv6 префикс срезается, приватные
 * адреса (docker-мост, LAN) читателю ничего не говорят — пишем «локальная сеть».
 */
function humanIp(ip: string | null): string {
  const bare = (ip ?? '').replace(/^::ffff:/i, '').trim();
  if (!bare) return 'неизвестен';
  return isPrivateIp(bare) ? 'локальная сеть' : bare;
}

export interface SecurityEventNotificationInput {
  /** subject_id пайщика (user.id) — для резолва получателя. */
  subjectId: string;
  /** Тип критичного события безопасности. */
  kind: SecurityEventKind;
  /** IP-адрес, с которого выполнено действие. */
  ip: string | null;
}

/**
 * Уведомление о критичном событии безопасности (CoopID, Story 3.11).
 *
 * Триггерится из сервисов, фиксирующих такие события (2FA enable/disable — Story 3.6,
 * смена стратегии восстановления — Story 3.5; смена пароля / ротация ключа — Story 3.3
 * после её реализации), сразу после записи в `audit_events`. Ставит в очередь Центра
 * уведомлений сообщение «<что>, <когда>, <с какого IP>» через workflow `security-event`
 * (email + in-app).
 *
 * Всё best-effort: ошибка доставки логируется и проглатывается — операция (отключение
 * 2FA, смена стратегии) не должна падать из-за недоступности уведомлений. В отличие от
 * 3.9, троттла НЕТ: каждое изменение безопасности должно уведомлять (ценность детекции).
 *
 * Ссылка «Это не я» ведёт на страницу безопасности ЛК; выделенный one-click endpoint —
 * Story 3.10.
 */
@Injectable()
export class SecurityEventNotificationService {
  private readonly logger = new Logger(SecurityEventNotificationService.name);

  constructor(
    @Inject(NOTIFICATION_PORT) private readonly notifications: INotificationPort,
    @Inject(USER_DOMAIN_SERVICE) private readonly users: UserDomainService,
  ) {}

  /**
   * Отправляет уведомление о событии безопасности. Никогда не бросает —
   * вызывающая операция не должна зависеть от доставки уведомления.
   */
  async notify(input: SecurityEventNotificationInput): Promise<void> {
    try {
      const user = await this.users.findUserById(input.subjectId);
      // Без subscriber_id Центр уведомлений не может адресовать получателя — пропускаем.
      if (!user || !user.subscriber_id) {
        this.logger.warn(`security-event уведомление пропущено: нет получателя для ${input.subjectId}`);
        return;
      }

      await this.notifications.notify({
        coopname: config.coopname,
        workflowId: Workflows.SecurityEvent.id,
        to: {
          subscriberId: user.subscriber_id,
          // Email — только подтверждённый (gate email-канала); in-app идёт по subscriber_id.
          email: user.is_email_verified ? user.email : undefined,
          username: user.username,
        },
        payload: {
          event: SECURITY_EVENT_TITLES[input.kind],
          ip: humanIp(input.ip),
          time: new Date().toISOString(),
          // Канонический формат ссылок — путь БЕЗ `#` (прод = history-роутер).
          // Страница настроек несёт сессии и смену пароля — туда и ведём.
          securityUrl: `${config.frontend_url}/${config.coopname}/user/settings`,
        },
      });
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      this.logger.warn(`security-event уведомление (${input.kind}) не отправлено для ${input.subjectId}: ${reason}`);
    }
  }
}
