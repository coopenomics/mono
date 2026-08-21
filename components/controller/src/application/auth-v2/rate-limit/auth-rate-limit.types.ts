import type { Request } from 'express';
import type { AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';

/** Окна (мс): см. Story 9.1 AC / NFR10. */
export const RATE_LIMIT_WINDOW_15M = 15 * 60 * 1000;
export const RATE_LIMIT_WINDOW_1H = 60 * 60 * 1000;

/**
 * Политика нарастающей блокировки (Story 3.12, NFR13). При каждом повторном
 * срабатывании лимита по одному трекеру длительность блока растёт по `tiers`
 * (последний тир — потолок). `memoryTtl` — скользящее окно памяти страйков:
 * после простоя длиной `memoryTtl` счётчик страйков забывается и эскалация
 * начинается с первого тира заново.
 */
export interface EscalationPolicy {
  /** длительности блока по номеру страйка (мс): [1ч, 4ч, 12ч, 24ч]. */
  tiers: number[];
  /** окно памяти страйков (мс). */
  memoryTtl: number;
}

/** Одно правило лимита: не более `limit` обращений за окно `ttl` (мс). */
export interface RateLimitRule {
  limit: number;
  /** окно в миллисекундах */
  ttl: number;
  /**
   * Необязательная нарастающая блокировка (Story 3.12). Если задана — при превышении
   * лимита блок ставится не на длину окна, а на тир из `escalating.tiers` по номеру
   * страйка трекера. Не задана → поведение Story 9.1 (фиксированный блок = окно).
   */
  escalating?: EscalationPolicy;
}

/**
 * Извлечь идентификатор аккаунта для per-account ключа из запроса. Возвращает
 * `null|undefined`, если идентификатор недоступен ДО хендлера (тогда account-ключ
 * пропускается, работает только per-IP) — например, на session/bind, где username
 * резолвится из cookie authentik уже внутри обработчика.
 */
export type AccountKeyExtractor = (req: Request) => string | null | undefined;

/** Конфиг двухключевого rate-limit для endpoint'а: всегда per-IP, опционально per-account. */
export interface AuthRateLimitConfig {
  ip: RateLimitRule;
  account?: RateLimitRule & { key: AccountKeyExtractor };
  /**
   * Кастомный код/сообщение ошибки при превышении (OAuth2-формат). Если не задан —
   * guard бросает дефолтный `TooManyAttempts`. Recovery-эндпоинт (Story 3.1) задаёт
   * `TooManyRecoveryAttempts` — AC различает его и общий лимит контура входа.
   */
  error?: { code: AuthV2ErrorCode; message: string };
}

/** Ключ метаданных, под которым `@AuthRateLimit` кладёт конфиг для guard'а. */
export const AUTH_RATE_LIMIT_METADATA = 'auth-v2:rate-limit';

// --- Пресеты лимитов (Story 9.1 AC) ---

/** Per-IP для login-flow: 50 обращений / 15 мин. */
export const LOGIN_IP_RULE: RateLimitRule = { limit: 50, ttl: RATE_LIMIT_WINDOW_15M };

/** Per-account для login-flow: 5 обращений / 15 мин. */
export const LOGIN_ACCOUNT_RULE: RateLimitRule = { limit: 5, ttl: RATE_LIMIT_WINDOW_15M };

/**
 * Magic-link (NFR10): 3 / час по обоим ключам. Endpoint magic-link — Story 3.1
 * (ещё нет); пресет готов и навешивается на него при появлении.
 */
export const MAGIC_LINK_RULE: RateLimitRule = { limit: 3, ttl: RATE_LIMIT_WINDOW_1H };

// --- Нарастающая блокировка (Story 3.12, NFR13) ---

/** Тиры длительности блока по номеру страйка: 1ч → 4ч → 12ч → 24ч (потолок). */
export const LOCKOUT_TIERS_MS = [
  1 * RATE_LIMIT_WINDOW_1H,
  4 * RATE_LIMIT_WINDOW_1H,
  12 * RATE_LIMIT_WINDOW_1H,
  24 * RATE_LIMIT_WINDOW_1H,
];

/**
 * Пресет эскалации для контура восстановления доступа (Story 3.12). Память страйков
 * — сутки: повторные злоупотребления в пределах 24ч продолжают наращивать блок до
 * потолка 24ч; после суток простоя счётчик сбрасывается. «Включает 24h-cooldown
 * recovery» из заголовка истории — это верхний тир, выставляемый на recovery-гейте.
 */
export const ESCALATING_LOCKOUT: EscalationPolicy = {
  tiers: LOCKOUT_TIERS_MS,
  memoryTtl: 24 * RATE_LIMIT_WINDOW_1H,
};
