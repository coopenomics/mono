import { createHash, randomInt } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import httpStatus from 'http-status';
import { HttpApiError } from '@coopenomics/extension-kit';
import { Workflows } from '@coopenomics/notifications';
import config from '~/config/config';
import { EMAIL_VERIFICATION_STORE } from '~/domain/auth-v2/ports/email-verification-store.port';
import type { IEmailVerificationStore } from '~/domain/auth-v2/ports/email-verification-store.port';
import { USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import type { UserDomainService } from '~/domain/user/services/user-domain.service';
import { NotificationService } from '~/application/notification-center/notification.service';
import { normalizeUserEmail } from '~/utils/normalize-user-email';

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
   * Выслать код на адрес.
   *
   * Возвращает одно и то же независимо от того, знаком нам адрес или нет:
   * мутация открыта (на шаге регистрации сессии ещё нет), и разный ответ
   * превратил бы её в проверялку «кто состоит в кооперативе».
   */
  async request(rawEmail: string, ip: string | null): Promise<EmailVerificationRequestResult> {
    const email = normalizeUserEmail(rawEmail);
    if (!email || !email.includes('@')) {
      throw new HttpApiError(httpStatus.BAD_REQUEST, 'Укажите корректный адрес электронной почты.');
    }

    await this.assertIpWithinLimit(ip);

    const cooldown = await this.store.resendCooldown(email);
    if (cooldown > 0) {
      // Не ошибка: пайщик мог обновить страницу. Отдаём остаток окна, чтобы
      // интерфейс показал обратный отсчёт вместо «отправить ещё раз».
      return { cooldown_seconds: cooldown, expires_seconds: CODE_TTL_SEC };
    }

    const existing = await this.store.get(email);
    if (existing && existing.sendCount >= MAX_SENDS_PER_WINDOW) {
      this.logger.warn('email-verify: на адрес исчерпан лимит писем за окно');
      throw new HttpApiError(
        httpStatus.TOO_MANY_REQUESTS,
        'Слишком много писем на этот адрес. Попробуйте через 15 минут.'
      );
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

  /** Один IP не должен рассылать коды по чужим ящикам. */
  private async assertIpWithinLimit(ip: string | null): Promise<void> {
    if (!ip) return;
    const perIp = await this.store.bumpRequests('ip', ip, 60 * 60);
    if (perIp > MAX_REQUESTS_PER_IP_HOUR) {
      this.logger.warn(`email-verify: IP ${ip} превысил лимит запросов кода за час`);
      throw new HttpApiError(httpStatus.TOO_MANY_REQUESTS, 'Слишком много запросов. Попробуйте позже.');
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
        payload: { code, ttl: '15 минут' },
      });
    } catch (e) {
      this.logger.error(`email-verify: письмо с кодом не поставлено в очередь: ${e instanceof Error ? e.message : e}`);
      throw new HttpApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Не удалось отправить письмо с кодом. Попробуйте позже.'
      );
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
      throw new HttpApiError(
        httpStatus.BAD_REQUEST,
        'Код не запрашивался или уже недействителен. Запросите новый.',
      );
    }

    if (sha256Hex(code) !== state.codeHash) {
      const attempts = await this.store.bumpAttempts(email, CODE_TTL_SEC);
      if (attempts >= MAX_ATTEMPTS) {
        // Перебор шестизначного кода не должен окупаться: сжигаем код целиком.
        await this.store.delete(email);
        this.logger.warn(`email-verify: код сожжён после ${attempts} неверных попыток`);
        throw new HttpApiError(
          httpStatus.BAD_REQUEST,
          'Слишком много неверных попыток. Запросите новый код.',
        );
      }
      throw new HttpApiError(httpStatus.BAD_REQUEST, 'Неверный код. Проверьте письмо и попробуйте ещё раз.');
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
