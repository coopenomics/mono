import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Workflows } from '@coopenomics/notifications';
import config from '~/config/config';
import { NOTIFICATION_PORT } from '@coopenomics/innercoop';
import type { INotificationPort } from '@coopenomics/innercoop';
import { USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import type { UserDomainService } from '~/domain/user/services/user-domain.service';
import { REDIS_PORT } from '~/domain/common/ports/redis.port';
import type { RedisPort } from '~/domain/common/ports/redis.port';
import { AuthV2Error, AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import type { DegradedAuthReason } from '~/domain/auth-v2/degraded/degraded-auth.types';
import { LOGIN_FACTORS_REPOSITORY } from '~/domain/auth-v2/ports/login-factors.port';
import type { ILoginFactorsRepository } from '~/domain/auth-v2/ports/login-factors.port';
import { LOGIN_CHALLENGE_STORE, LoginFactorKind } from '~/domain/auth-v2/ports/login-challenge-store.port';
import type { ILoginChallengeStore, LoginChallengeState } from '~/domain/auth-v2/ports/login-challenge-store.port';
import { TWO_FACTOR_VERIFIER } from '~/domain/auth-v2/ports/two-factor.port';
import type { ITwoFactorVerifier } from '~/domain/auth-v2/ports/two-factor.port';
import { AuditService } from '../audit/audit.service';
import { AuthMetricsService } from '../metrics/auth-metrics.service';
import { SessionIssueService } from '../verify-timestamp/session-issue.service';
import type { SessionIssueResult } from '../verify-timestamp/session-issue.service';

/** Окно на прохождение факторов после доказательства пароля и ключа. */
const CHALLENGE_TTL_SEC = 10 * 60;
/** Порог неверных кодов на фактор — дальше challenge сжигается, вход заново. */
const MAX_CODE_ATTEMPTS = 5;
/** Троттл повторной отправки email-кода. */
const EMAIL_RESEND_THROTTLE_SEC = 60;
/** Потолок отправок email-кода на один challenge. */
const MAX_EMAIL_SENDS = 5;
/** Grace-окно после recovery: email-ссылка и TOTP уже доказаны, код не спрашиваем. */
const GRACE_TTL_SEC = 5 * 60;
const GRACE_KEY_PREFIX = 'coopid:login2fa:grace:';

/** Пайщик в объёме, нужном контуру 2FA-входа (подмножество user-домена). */
export interface LoginFactorsUserView {
  id: string;
  username: string;
  email?: string | null;
  is_email_verified?: boolean;
  subscriber_id?: string | null;
}

export interface SecondFactorChallengeResult {
  second_factor_required: true;
  challenge_token: string;
  /** Очередь факторов в порядке прохождения. */
  factors: LoginFactorKind[];
}

/** Промежуточный исход confirm: фактор пройден, остался следующий. */
export interface SecondFactorProgressResult {
  passed_factor: LoginFactorKind;
  next_factor: LoginFactorKind;
}

export type SecondFactorConfirmResult = SecondFactorProgressResult | SessionIssueResult;

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Сравнение кодов без утечки по времени (оба операнда — hex sha256 фиксированной длины). */
function hashEquals(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, 'hex');
  const b = Buffer.from(bHex, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Второй фактор ВХОДА (2FA-логин): TOTP из приложения-аутентификатора и/или
 * одноразовый код на почту.
 *
 * Криптографический инвариант: challenge создаётся только ПОСЛЕ доказательства
 * пароля (authentik) и владения ключом (verify-timestamp), а платформенные токены
 * выпускает исключительно {@link SessionIssueService} — либо сразу (факторы не
 * включены), либо здесь, после прохождения всех факторов. Состояние challenge
 * живёт на сервере (Redis): клиент не может ни отметить фактор пройденным, ни
 * продлить окно, ни перебрать коды (атомарный счётчик попыток + сжигание).
 *
 * Оба фактора включены → проходятся последовательно: сначала приложение
 * (офлайн, дешёвый), затем почта (код отправляется только когда до неё дошла
 * очередь — провал TOTP не тратит письма).
 */
@Injectable()
export class LoginTwoFactorService {
  private readonly logger = new Logger(LoginTwoFactorService.name);

  constructor(
    @Inject(LOGIN_FACTORS_REPOSITORY) private readonly factorsRepo: ILoginFactorsRepository,
    @Inject(LOGIN_CHALLENGE_STORE) private readonly challenges: ILoginChallengeStore,
    @Inject(TWO_FACTOR_VERIFIER) private readonly twoFactor: ITwoFactorVerifier,
    @Inject(USER_DOMAIN_SERVICE) private readonly users: UserDomainService,
    @Inject(NOTIFICATION_PORT) private readonly notifications: INotificationPort,
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
    private readonly audit: AuditService,
    private readonly metrics: AuthMetricsService,
    private readonly sessionIssue: SessionIssueService,
  ) {}

  /**
   * Действующие факторы входа пайщика: включённые настройкой И физически
   * доступные (TOTP — секрет подключён; email — почта подтверждена и есть адрес
   * доставки). Недоступный фактор пропускается, а не запирает вход намертво:
   * настройка могла пережить отключение TOTP или смену почты.
   */
  async effectiveFactors(user: LoginFactorsUserView): Promise<LoginFactorKind[]> {
    const settings = await this.factorsRepo.get(user.id);
    if (!settings) return [];
    const factors: LoginFactorKind[] = [];
    if (settings.totpEnabled && (await this.twoFactor.isEnabled(user.id))) factors.push(LoginFactorKind.Totp);
    if (settings.emailEnabled && user.is_email_verified && user.subscriber_id) factors.push(LoginFactorKind.Email);
    return factors;
  }

  /**
   * Гейт легаси-входа по подписи: включён ли хоть один фактор В НАСТРОЙКАХ.
   * Намеренно строже effectiveFactors (без фильтра доступности) — легаси-контур
   * не умеет спрашивать коды вовсе, поэтому fail-closed: включил 2FA → входишь
   * только новым контуром.
   */
  async hasEnabledFactorSettings(subjectId: string): Promise<boolean> {
    const settings = await this.factorsRepo.get(subjectId);
    return !!settings && (settings.totpEnabled || settings.emailEnabled);
  }

  /**
   * Начать challenge, если у пайщика включены факторы. null — факторы не нужны
   * (или действует post-recovery grace) и вход финализируется сразу.
   */
  async maybeBeginChallenge(input: {
    user: LoginFactorsUserView;
    sub: string;
    ip: string | null;
    userAgent: string | null;
    acceptLanguage: string | null;
    degraded: boolean;
    degradedReason?: DegradedAuthReason;
  }): Promise<SecondFactorChallengeResult | null> {
    const factors = await this.effectiveFactors(input.user);
    if (!factors.length) return null;

    // Grace после recovery (single-use): подтверждение только что пройдено сильнее —
    // magic-link доказал почту, confirm — TOTP. Спрашивать код второй раз подряд незачем.
    const grace = await this.redis.consumeSingleUse(`${GRACE_KEY_PREFIX}${input.user.id}`);
    if (grace !== null) {
      await this.safeAudit({ event: 'coopid.verify.second_factor', subjectId: input.sub, actor: input.sub, result: 'success', context: { reason: 'recovery_grace' }, ip: input.ip });
      return null;
    }

    const state: LoginChallengeState = {
      subjectId: input.user.id,
      sub: input.sub,
      factors,
      passed: [],
      emailCodeHash: null,
      emailSendCount: 0,
      ip: input.ip,
      userAgent: input.userAgent,
      acceptLanguage: input.acceptLanguage,
      degraded: input.degraded,
      degradedReason: input.degradedReason,
    };

    // Email-код отправляется только когда фактор первый в очереди — иначе дождётся TOTP.
    if (factors[0] === LoginFactorKind.Email) await this.attachFreshEmailCode(state);

    const token = await this.challenges.create(state, CHALLENGE_TTL_SEC);
    await this.safeAudit({ event: 'coopid.verify.second_factor', subjectId: input.sub, result: 'pending', context: { factors }, ip: input.ip });
    return { second_factor_required: true, challenge_token: token, factors };
  }

  /**
   * Подтвердить текущий фактор challenge. Все факторы пройдены → финализация
   * входа (выпуск токенов) и сжигание challenge; иначе — следующий фактор.
   */
  async confirm(input: { token: string; code: string; ip: string | null }): Promise<SecondFactorConfirmResult> {
    const state = await this.requireState(input.token);
    const current = state.factors[state.passed.length];
    if (!current) {
      // Дефектное состояние (все пройдены, но challenge не сожжён) — не выпускаем ничего.
      await this.challenges.delete(input.token);
      throw new AuthV2Error(AuthV2ErrorCode.LoginChallengeExpired, 'Подтверждение входа истекло — войдите заново.');
    }

    const ok = await this.verifyFactor(state, current, input.code);
    if (!ok) {
      const attempts = await this.challenges.bumpAttempts(input.token, current, CHALLENGE_TTL_SEC);
      await this.safeAudit({ event: 'coopid.verify.second_factor', subjectId: state.sub, result: 'failure', context: { factor: current, attempts }, ip: input.ip });
      if (attempts >= MAX_CODE_ATTEMPTS) {
        // Сжигаем challenge: перебор кодов упирается в повторный вход (пароль + ключ).
        await this.challenges.delete(input.token);
        throw new AuthV2Error(AuthV2ErrorCode.TooManyAttempts, 'Слишком много неверных кодов — войдите заново.');
      }
      throw new AuthV2Error(
        AuthV2ErrorCode.InvalidTwoFactorCode,
        current === LoginFactorKind.Totp
          ? 'Неверный код из приложения-аутентификатора.'
          : 'Неверный код из письма.',
      );
    }

    state.passed.push(current);
    const next = state.factors[state.passed.length];

    if (next) {
      if (next === LoginFactorKind.Email && !state.emailCodeHash) await this.attachFreshEmailCode(state);
      await this.challenges.put(input.token, state);
      await this.safeAudit({ event: 'coopid.verify.second_factor', subjectId: state.sub, result: 'pending', context: { passed: current, next }, ip: input.ip });
      return { passed_factor: current, next_factor: next };
    }

    // Все факторы пройдены: challenge сжигается ДО выпуска токенов (single-use).
    await this.challenges.delete(input.token);
    await this.safeAudit({ event: 'coopid.verify.second_factor', subjectId: state.sub, actor: state.sub, result: 'success', context: { factors: state.factors }, ip: input.ip });
    const result = await this.sessionIssue.issue({
      userId: state.subjectId,
      sub: state.sub,
      ip: state.ip,
      userAgent: state.userAgent,
      acceptLanguage: state.acceptLanguage,
      degraded: state.degraded,
      degradedReason: state.degradedReason,
    });
    this.metrics.loginSuccess();
    return result;
  }

  /** Повторно отправить email-код (текущий фактор — email; троттл + потолок отправок). */
  async resendEmailCode(token: string, ip: string | null): Promise<void> {
    const state = await this.requireState(token);
    const current = state.factors[state.passed.length];
    if (current !== LoginFactorKind.Email) {
      throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, 'Код на почту сейчас не запрашивается.');
    }
    if (state.emailSendCount >= MAX_EMAIL_SENDS) {
      throw new AuthV2Error(AuthV2ErrorCode.TooManyAttempts, 'Лимит отправок кода исчерпан — войдите заново.');
    }
    if (!(await this.challenges.tryAcquireResend(token, EMAIL_RESEND_THROTTLE_SEC))) {
      throw new AuthV2Error(AuthV2ErrorCode.TooManyAttempts, 'Код уже отправлен — подождите минуту перед повтором.');
    }
    await this.attachFreshEmailCode(state);
    await this.challenges.put(token, state);
    await this.safeAudit({ event: 'coopid.verify.second_factor', subjectId: state.sub, result: 'pending', context: { reason: 'email_code_resent' }, ip });
  }

  /**
   * Выдать single-use grace-окно (используется финализацией recovery: почта и
   * TOTP там только что доказаны — первый вход после восстановления без кодов).
   */
  async grantGrace(userId: string): Promise<void> {
    await this.redis.setSingleUse(`${GRACE_KEY_PREFIX}${userId}`, '1', GRACE_TTL_SEC);
  }

  private async requireState(token: string): Promise<LoginChallengeState> {
    const state = await this.challenges.get(token);
    if (!state) {
      throw new AuthV2Error(AuthV2ErrorCode.LoginChallengeExpired, 'Подтверждение входа истекло — войдите заново.');
    }
    return state;
  }

  private async verifyFactor(state: LoginChallengeState, factor: LoginFactorKind, code: string): Promise<boolean> {
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) return false;
    if (factor === LoginFactorKind.Totp) return this.twoFactor.verify(state.subjectId, trimmed);
    if (!state.emailCodeHash) return false;
    return hashEquals(sha256Hex(trimmed), state.emailCodeHash);
  }

  /**
   * Сгенерировать и отправить свежий email-код. Fail-closed: сбой доставки —
   * ошибка входа, а не молчаливый пропуск фактора (иначе отказ почтовой
   * инфраструктуры превращался бы в отключение 2FA).
   */
  private async attachFreshEmailCode(state: LoginChallengeState): Promise<void> {
    const user = await this.users.findUserById(state.subjectId);
    if (!user || !user.subscriber_id || !user.is_email_verified) {
      throw new AuthV2Error(AuthV2ErrorCode.CooposDegraded, 'Не удалось отправить код подтверждения на почту.');
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    try {
      await this.notifications.notify({
        coopname: config.coopname,
        workflowId: Workflows.LoginEmailCode.id,
        to: { subscriberId: user.subscriber_id, email: user.email, username: user.username },
        payload: { code, ttl: '10 минут' },
      });
    } catch (e) {
      this.logger.warn(`email-код входа не отправлен для ${state.sub}: ${e instanceof Error ? e.message : e}`);
      throw new AuthV2Error(AuthV2ErrorCode.CooposDegraded, 'Не удалось отправить код подтверждения на почту. Повторите попытку позже.');
    }
    // Хэш пишется только после успешной постановки в очередь — старый код остаётся
    // действующим при сбое отправки нового.
    state.emailCodeHash = sha256Hex(code);
    state.emailSendCount += 1;
  }

  /** Аудит не должен валить вход (coop_domain_db недоступен → лог, не 500). */
  private async safeAudit(record: Parameters<AuditService['record']>[0]): Promise<void> {
    try {
      await this.audit.record(record);
    } catch {
      // намеренно проглатываем: audit-инфраструктура отдельна от auth-критпути
    }
  }
}
