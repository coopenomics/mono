import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Workflows } from '@coopenomics/notifications';
import config from '~/config/config';
import { NOTIFICATION_PORT } from '@coopenomics/innercoop';
import type { INotificationPort } from '@coopenomics/innercoop';
import { USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import type { UserDomainService } from '~/domain/user/services/user-domain.service';
import { normalizeUserEmail } from '~/utils/normalize-user-email';
import { RECOVERY_TOKEN_STORE } from '~/domain/auth-v2/ports/recovery-token-store.port';
import type { IRecoveryTokenStore } from '~/domain/auth-v2/ports/recovery-token-store.port';
import { RecoveryStrategy } from '~/domain/auth-v2/recovery-strategy/recovery-strategy.types';
import { AuthV2Error, AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { TWO_FACTOR_VERIFIER } from '~/domain/auth-v2/ports/two-factor.port';
import type { ITwoFactorVerifier } from '~/domain/auth-v2/ports/two-factor.port';
import { AuditService } from '../audit/audit.service';
import { RecoveryStrategyService } from './recovery-strategy.service';

/** TTL recovery-токена (Story 3.1 AC): magic-link живёт 5 минут. */
const RECOVERY_TOKEN_TTL_SEC = 5 * 60;

/**
 * Маска адреса для журнала: `iv***@yandex.ru`. Полный email не пишем — логи
 * читает более широкий круг, чем профиль пайщика, — но домена и двух первых
 * букв хватает, чтобы при разборе обращения опознать, о каком адресе речь,
 * и увидеть опечатку в домене.
 */
function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  return `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`;
}

/**
 * Инициация восстановления доступа через email (CoopID, Story 3.1).
 *
 * Источник пайщика и email — user-домен coopback (`findUserByEmail`); таблицы
 * `participants` из AC в brownfield-mono нет, реестр пайщиков один — пользователи.
 * Письмо доставляет готовый Центр уведомлений (`NOTIFICATION_PORT`, workflow
 * `reset-key`) — собственный SMTP здесь не нужен.
 *
 * Наружу исход КОНСТАНТЕН (контроллер всегда отвечает 202) — это анти-enumeration.
 * Внутрь, наоборот, причина отказа обязана быть видна: до 03.09.2026 все ветки
 * отказа писались в `logger.debug`, а на проде уровень логгера выше, и в журнале
 * не оставалось ни следа, почему письмо не ушло. Разбор обращения по ВОСХОДу
 * (7 запросов за 30 дней, 0 писем) упёрся именно в эту немоту. Теперь каждая
 * ветка — `warn` в лог и `failure` в audit с машинной причиной.
 */
@Injectable()
export class RecoveryService {
  private readonly logger = new Logger(RecoveryService.name);

  constructor(
    @Inject(NOTIFICATION_PORT) private readonly notifications: INotificationPort,
    @Inject(USER_DOMAIN_SERVICE) private readonly users: UserDomainService,
    @Inject(RECOVERY_TOKEN_STORE) private readonly tokenStore: IRecoveryTokenStore,
    private readonly strategy: RecoveryStrategyService,
    private readonly audit: AuditService,
    @Inject(TWO_FACTOR_VERIFIER) private readonly twoFactor: ITwoFactorVerifier,
  ) {}

  /**
   * Запросить magic-link восстановления по email. Исход КОНСТАНТЕН для вызывающего
   * (контроллер всегда отвечает 202): существование email наружу не раскрывается —
   * защита от перечисления пользователей (user enumeration).
   */
  async requestByEmail(rawEmail: string, ip: string | null): Promise<void> {
    const email = normalizeUserEmail(rawEmail);
    const masked = maskEmail(email);
    const user = await this.users.findUserByEmail(email);

    if (!user) {
      // Самая частая причина на практике — опечатка в адресе (домен `.ry` вместо
      // `.ru`); маска в логе позволяет это увидеть, не вынося адрес целиком.
      this.logger.warn(`recovery: пайщик по адресу ${masked} не найден — письмо не отправлено`);
      await this.recordFailure('user_not_found', null, ip);
      return;
    }

    // Подтверждение email больше НЕ гейтит восстановление (решение 03.09.2026).
    // На проде верификацию почты не проходил никто (за 45 дней ни одного вызова
    // `verifyEmail`), и гейт запирал единственный способ вернуть доступ тем, кто
    // потерял пароль. Верификация почт — отдельный поток; когда он поедет, ветку
    // возвращаем сюда осознанным решением, а не побочным эффектом. Факт остаётся
    // виден в audit-контексте (`email_verified`) — по нему видно, скольким письмо
    // ушло на неподтверждённый адрес.
    if (!user.subscriber_id) {
      this.logger.warn(
        `recovery: у пайщика ${user.username} (${masked}) нет subscriber_id — адрес Центра уведомлений не настроен, письмо не отправлено`,
      );
      await this.recordFailure('no_subscriber_id', user.id, ip);
      return;
    }

    // Гейтинг стратегии (Story 3.5): email-канал работает только если он выбран.
    // Исход остаётся константным (void) — стратегия наружу не раскрывается.
    if (!(await this.strategy.isChannelActive(user.id, RecoveryStrategy.EmailMagicLink))) {
      this.logger.warn(
        `recovery: у пайщика ${user.username} (${masked}) email-канал отключён стратегией — письмо не отправлено`,
      );
      await this.recordFailure('email_channel_disabled', user.id, ip);
      return;
    }

    const token = randomUUID();
    await this.tokenStore.issue(
      token,
      { subjectId: user.id, username: user.username, coopname: config.coopname },
      RECOVERY_TOKEN_TTL_SEC,
    );

    // Канонический формат ссылок платформы — путь БЕЗ `#` (прод работает в
    // history-режиме роутера). Dev-контур с hash-роутером не проблема: App.vue
    // при загрузке сам переносит path в hash (нормализация режима).
    const resetUrl = `${config.frontend_url}/${config.coopname}/auth/recover/${token}`;
    await this.notifications.notify({
      coopname: config.coopname,
      workflowId: Workflows.ResetKey.id,
      to: { subscriberId: user.subscriber_id, email, username: user.username },
      payload: { resetUrl },
    });

    this.logger.log(
      `recovery: письмо со ссылкой восстановления поставлено в очередь пайщику ${user.username} (${masked}), email_verified=${Boolean(user.is_email_verified)}`,
    );

    // Контекст без секретов: ни токена, ни URL, ни email (secret-blacklist AuditService).
    await this.audit.record({
      event: 'coopid.recovery.requested',
      subjectId: user.id,
      actor: 'self',
      result: 'success',
      context: { strategy: 'email_magic_link', email_verified: Boolean(user.is_email_verified) },
      ip,
    });
  }

  /**
   * Контекст ссылки восстановления: кому она выдана и нужен ли второй фактор.
   *
   * Нужен экрану подтверждения. Почту он раньше спрашивал у пайщика, хотя сервер знает
   * её по токену: лишний ввод, и опечатка в нём роняет повторный вход уже ПОСЛЕ смены
   * ключа. Код аутентификатора экран просил безусловно — у того, кто 2FA не подключал,
   * это тупик. Отдаём оба факта, и экран собирает форму по ним (владелец 03.09.2026).
   *
   * Токен не потребляется (`peek`): открыть страницу — ещё не подтвердить. Раскрытие
   * почты по токену не расширяет поверхность атаки — сам токен уже даёт право сменить
   * ключ, а живёт он 5 минут и приходит только на этот адрес.
   */
  async contextByToken(token: string): Promise<{ email: string; two_factor_required: boolean }> {
    const payload = await this.tokenStore.peek(token);
    if (!payload) {
      throw new AuthV2Error(
        AuthV2ErrorCode.InvalidRecoveryToken,
        'Ссылка восстановления недействительна или истекла. Запросите восстановление заново.',
      );
    }
    const user = await this.users.findUserById(payload.subjectId);
    if (!user) {
      // Токен жив, а пайщика уже нет — та же реакция, что и на протухшую ссылку.
      this.logger.warn(`recovery: токен ссылки указывает на несуществующего пайщика ${payload.subjectId}`);
      throw new AuthV2Error(
        AuthV2ErrorCode.InvalidRecoveryToken,
        'Ссылка восстановления недействительна или истекла. Запросите восстановление заново.',
      );
    }
    const two_factor_required = await this.twoFactor.isEnabled(payload.subjectId);
    return { email: user.email, two_factor_required };
  }

  /**
   * Аудит отказа — best-effort: журнал не имеет права ронять ручку. Исход наружу
   * константен (202), и недоступный coop-postgres не повод отдать пайщику 500,
   * заодно выдав по коду ответа, что адрес существует.
   */
  private async recordFailure(reason: string, subjectId: string | null, ip: string | null): Promise<void> {
    try {
      await this.audit.record({
        event: 'coopid.recovery.requested',
        subjectId,
        actor: 'self',
        result: 'failure',
        context: { reason },
        ip,
      });
    } catch (error) {
      this.logger.error(`recovery: не удалось записать audit-событие отказа (${reason})`, error as Error);
    }
  }
}
