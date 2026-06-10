import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Workflows } from '@coopenomics/notifications';
import config from '~/config/config';
import { NOTIFICATION_PORT } from '~/domain/notification/interfaces/notify.port';
import type { NotificationPort } from '~/domain/notification/interfaces/notify.port';
import { USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import type { UserDomainService } from '~/domain/user/services/user-domain.service';
import { normalizeUserEmail } from '~/utils/normalize-user-email';
import { RECOVERY_TOKEN_STORE } from '~/domain/auth-v2/ports/recovery-token-store.port';
import type { IRecoveryTokenStore } from '~/domain/auth-v2/ports/recovery-token-store.port';
import { AuditService } from '../audit/audit.service';

/** TTL recovery-токена (Story 3.1 AC): magic-link живёт 5 минут. */
const RECOVERY_TOKEN_TTL_SEC = 5 * 60;

/**
 * Инициация восстановления доступа через email (CoopID, Story 3.1).
 *
 * Источник пайщика и email — user-домен coopback (`findUserByEmail`); таблицы
 * `participants` из AC в brownfield-mono нет, реестр пайщиков один — пользователи.
 * Письмо доставляет готовый Центр уведомлений (`NOTIFICATION_PORT`, workflow
 * `reset-key`) — собственный SMTP здесь не нужен.
 */
@Injectable()
export class RecoveryService {
  private readonly logger = new Logger(RecoveryService.name);

  constructor(
    @Inject(NOTIFICATION_PORT) private readonly notifications: NotificationPort,
    @Inject(USER_DOMAIN_SERVICE) private readonly users: UserDomainService,
    @Inject(RECOVERY_TOKEN_STORE) private readonly tokenStore: IRecoveryTokenStore,
    private readonly audit: AuditService,
  ) {}

  /**
   * Запросить magic-link восстановления по email. Исход КОНСТАНТЕН для вызывающего
   * (контроллер всегда отвечает 202): существование email наружу не раскрывается —
   * защита от перечисления пользователей (user enumeration).
   */
  async requestByEmail(rawEmail: string, ip: string | null): Promise<void> {
    const email = normalizeUserEmail(rawEmail);
    const user = await this.users.findUserByEmail(email);

    // Анти-enumeration: молча выходим, если пайщика нет, email не подтверждён или
    // нет subscriber_id (адрес Центра уведомлений ещё не настроен).
    if (!user || !user.is_email_verified || !user.subscriber_id) {
      this.logger.debug('recovery: запрос по неизвестному/неподтверждённому email — тихий выход');
      return;
    }

    const token = randomUUID();
    await this.tokenStore.issue(
      token,
      { subjectId: user.id, username: user.username, coopname: config.coopname },
      RECOVERY_TOKEN_TTL_SEC,
    );

    const resetUrl = `${config.frontend_url}/recover/${token}`;
    await this.notifications.notify({
      coopname: config.coopname,
      workflowId: Workflows.ResetKey.id,
      to: { subscriberId: user.subscriber_id, email, username: user.username },
      payload: { resetUrl },
    });

    // Контекст без секретов: ни токена, ни URL, ни email (secret-blacklist AuditService).
    await this.audit.record({
      event: 'coopid.recovery.requested',
      subjectId: user.id,
      actor: 'self',
      result: 'success',
      context: { strategy: 'email_magic_link' },
      ip,
    });
  }
}
