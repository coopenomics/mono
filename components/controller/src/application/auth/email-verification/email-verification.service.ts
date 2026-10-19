import { createHash, randomInt } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import httpStatus from 'http-status';
import { DomainError } from '@coopenomics/extension-kit';
import { Workflows } from '@coopenomics/notifications';
import config from '~/config/config';
import { EMAIL_VERIFICATION_STORE } from '~/domain/auth-v2/ports/email-verification-store.port';
import type { IEmailVerificationStore } from '~/domain/auth-v2/ports/email-verification-store.port';
import { USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import type { UserDomainService } from '~/domain/user/services/user-domain.service';
import { NotificationService } from '~/application/notification-center/notification.service';
import { normalizeUserEmail } from '~/utils/normalize-user-email';
import { t } from '~/i18n';
import { EmailVerificationPurpose } from './email-verification-purpose.enum';

/** Окно жизни кода. Столько же живёт письмо в почте, прежде чем станет бесполезным. */
const CODE_TTL_SEC = 15 * 60;
/** Не чаще одного письма в минуту на адрес. */
const RESEND_THROTTLE_SEC = 60;
/** Неверных вводов подряд на один код. Дальше код сжигается — нужен новый. */
const MAX_ATTEMPTS = 5;
/** Сколько писем можно запросить на один адрес за окно кода. */
const MAX_SENDS_PER_WINDOW = 5;
/** Сколько адресов может обслужить один IP за час — защита от рассылки по чужим ящикам. */
const MAX_REQUESTS_PER_IP_HOUR = 20;
/**
 * Сколько проверок «занят ли адрес» один IP делает за час. Шаг ввода почты
 * спрашивает на каждой паузе в наборе, поэтому запас шире, чем у писем; предел
 * нужен, чтобы перебором адресов нельзя было выгрузить список пайщиков.
 */
const MAX_CHECKS_PER_IP_HOUR = 120;
/**
 * Отметка «адрес подтверждён» живёт сутки: между вводом кода на первом шаге
 * регистрации и созданием учётной записи пайщик проходит анкету, выбор
 * программы и подписание документов — это часы, а не минуты.
 */
const VERIFIED_TTL_SEC = 24 * 60 * 60;

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export interface EmailVerificationRequestResult {
  /** Через сколько секунд можно просить письмо повторно. */
  cooldown_seconds: number;
  /** Сколько секунд действует код. */
  expires_seconds: number;
}

/**
 * Подтверждение электронной почты кодом из письма.
 *
 * Один механизм на два сценария, потому что задача одна — доказать, что ящик
 * читает тот, кто его назвал:
 *  - **регистрация**: код спрашивается на шаге ввода почты, когда учётной записи
 *    ещё нет. Поэтому состояние привязано к АДРЕСУ, а не к пайщику; факт
 *    подтверждения кладётся в отметку, которую позже читает создание аккаунта.
 *  - **личный кабинет**: тот же код, но у адреса уже есть владелец — при успехе
 *    сразу проставляется `is_email_verified`.
 *
 * Раньше подтверждения не было вовсе: в кооператив приходили пайщики с
 * адресами, набранными с опечаткой, и обнаруживалось это только когда человек
 * не мог вернуть доступ — письмо восстановления уходило в никуда.
 */
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    @Inject(EMAIL_VERIFICATION_STORE) private readonly store: IEmailVerificationStore,
    @Inject(USER_DOMAIN_SERVICE) private readonly users: UserDomainService,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * Зарегистрирован ли адрес. Спрашивает шаг ввода почты в регистрации, пока
   * человек печатает: о занятом адресе он должен узнать сразу, а не после
   * поиска письма и анкеты (решение владельца 15.10.2026 — пайщик пытался
   * зарегистрироваться повторно на свой же адрес и ждал код).
   */
  async isRegistered(rawEmail: string, ip: string | null): Promise<boolean> {
    const email = this.normalizeOrReject(rawEmail);
    await this.assertIpWithinLimit(ip, 'email-check', MAX_CHECKS_PER_IP_HOUR);
    return this.users.isEmailRegistered(email);
  }

  /**
   * Выслать код на адрес.
   *
   * Для регистрации на зарегистрированный адрес код не отправляется: человеку
   * нужен вход или восстановление доступа, а письмо увело бы его искать код,
   * который всё равно упрётся в отказ при создании аккаунта. Из кабинета код
   * идёт на адрес владельца учётной записи, как и раньше.
   */
  async request(
    rawEmail: string,
    ip: string | null,
    purpose: EmailVerificationPurpose = EmailVerificationPurpose.Account,
  ): Promise<EmailVerificationRequestResult> {
    const email = this.normalizeOrReject(rawEmail);

    await this.assertIpWithinLimit(ip, 'ip', MAX_REQUESTS_PER_IP_HOUR);

    if (purpose === EmailVerificationPurpose.Registration && (await this.users.isEmailRegistered(email))) {
      throw DomainError.badRequest('AUTH_EMAIL_ALREADY_REGISTERED');
    }

    const cooldown = await this.store.resendCooldown(email);
    if (cooldown > 0) {
      // Не ошибка: пайщик мог обновить страницу. Отдаём остаток окна, чтобы
      // интерфейс показал обратный отсчёт вместо «отправить ещё раз».
      return { cooldown_seconds: cooldown, expires_seconds: CODE_TTL_SEC };
    }

    const existing = await this.store.get(email);
    if (existing && existing.sendCount >= MAX_SENDS_PER_WINDOW) {
      this.logger.warn('email-verify: на адрес исчерпан лимит писем за окно');
      throw DomainError.tooManyRequests('AUTH_EMAIL_RATE_LIMIT_ADDRESS');
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.deliverCode(email, code);

    // Пишем код только после успешной постановки в очередь: при сбое отправки
    // прежний код остаётся действующим, а не затирается неотправленным.
    const sendCount = (existing?.sendCount ?? 0) + 1;
    await this.store.put(email, { email, codeHash: sha256Hex(code), sendCount }, CODE_TTL_SEC);
    await this.store.tryAcquireResend(email, RESEND_THROTTLE_SEC);
    this.logger.log(`email-verify: код подтверждения поставлен в очередь (отправка №${sendCount})`);

    return { cooldown_seconds: RESEND_THROTTLE_SEC, expires_seconds: CODE_TTL_SEC };
  }

  private normalizeOrReject(rawEmail: string): string {
    const email = normalizeUserEmail(rawEmail);
    if (!email || !email.includes('@')) {
      throw DomainError.badRequest('AUTH_EMAIL_INVALID');
    }
    return email;
  }

  /**
   * Один IP не должен ни рассылать коды по чужим ящикам, ни перебирать адреса.
   * Счётчики писем и проверок раздельные: проверка частая и письма не шлёт.
   */
  private async assertIpWithinLimit(ip: string | null, scope: string, limit: number): Promise<void> {
    if (!ip) return;
    const perIp = await this.store.bumpRequests(scope, ip, 60 * 60);
    if (perIp > limit) {
      this.logger.warn(`email-verify: IP ${ip} превысил часовой лимит (${scope})`);
      throw DomainError.tooManyRequests('AUTH_EMAIL_RATE_LIMIT_GENERAL');
    }
  }

  /** Поставить письмо с кодом в очередь Центра уведомлений. */
  private async deliverCode(email: string, code: string): Promise<void> {
    // Dev-контур: почта на стенде настроена не всегда, а код нужен — печатаем в
    // консоль. На production НИКОГДА: секрет в логах недопустим.
    if (config.env !== 'production') {
      this.logger.log(`[dev] код подтверждения почты для ${email}: ${code}`);
    }

    try {
      await this.notifications.notify({
        coopname: config.coopname,
        workflowId: Workflows.EmailVerification.id,
        // Подписчика у адреса может не быть вовсе (регистрация ещё не дошла до
        // создания учётной записи). Письмо уходит по самому адресу, а в поле
        // подписчика кладётся синтетический идентификатор: колонка обязательна,
        // а доставка по нему не идёт.
        to: { subscriberId: `email:${email}`, email },
        payload: { code, ttl: t('auth.emailVerificationService.codeTtlLabel') },
      });
    } catch (e) {
      this.logger.error(`email-verify: письмо с кодом не поставлено в очередь: ${e instanceof Error ? e.message : e}`);
      throw DomainError.internal('AUTH_EMAIL_SEND_FAILED');
    }
  }

  /**
   * Проверить код. При успехе адрес считается подтверждённым: у существующего
   * пайщика проставляется `is_email_verified`, а для ещё не созданной учётной
   * записи кладётся отметка, которую прочитает регистрация.
   */
  async confirm(rawEmail: string, rawCode: string): Promise<boolean> {
    const email = normalizeUserEmail(rawEmail);
    const code = (rawCode ?? '').trim();

    const state = await this.store.get(email);
    if (!state) {
      throw DomainError.badRequest('AUTH_EMAIL_CODE_NOT_REQUESTED');
    }

    if (sha256Hex(code) !== state.codeHash) {
      const attempts = await this.store.bumpAttempts(email, CODE_TTL_SEC);
      if (attempts >= MAX_ATTEMPTS) {
        // Перебор шестизначного кода не должен окупаться: сжигаем код целиком.
        await this.store.delete(email);
        this.logger.warn(`email-verify: код сожжён после ${attempts} неверных попыток`);
        throw DomainError.badRequest('AUTH_EMAIL_CODE_TOO_MANY_ATTEMPTS');
      }
      throw DomainError.badRequest('AUTH_EMAIL_CODE_INVALID');
    }

    await this.store.delete(email);
    await this.store.markVerified(email, VERIFIED_TTL_SEC);

    const user = await this.users.findUserByEmail(email);
    if (user) {
      await this.users.updateUserById(user.id, { is_email_verified: true });
      this.logger.log(`email-verify: почта подтверждена пайщиком ${user.username}`);
    } else {
      this.logger.log('email-verify: адрес подтверждён до создания учётной записи (шаг регистрации)');
    }

    return true;
  }

  /**
   * Подтверждён ли адрес в текущем окне. Читает создание учётной записи, чтобы
   * пайщик, подтвердивший почту на первом шаге, не оказался с неподтверждённым
   * адресом после регистрации.
   */
  async isVerified(rawEmail: string): Promise<boolean> {
    return this.store.isVerified(normalizeUserEmail(rawEmail));
  }
}
