import type { ThrottlerStorage } from '@nestjs/throttler';

/**
 * Порт хранилища счётчиков rate-limit контура auth-v2 (CoopID, Story 9.1).
 * Реализация (infrastructure) — поверх Redis: счётчик переживает рестарт и общий
 * для нескольких инстансов controller'а. application/guard знают только токен;
 * сам контракт — `ThrottlerStorage` из `@nestjs/throttler` (адаптер его implements),
 * чтобы переиспользовать проверенную семантику increment/TTL/block.
 */
export const RATE_LIMIT_STORAGE = Symbol('RateLimitStorage');

/**
 * Результат нарастающей (escalating) проверки лимита (Story 3.12). Помимо обычных
 * полей `ThrottlerStorageRecord` несёт два сигнала эскалации:
 *  - `newlyBlocked` — блок ВЫСТАВЛЕН именно этим вызовом (переход), не висел раньше;
 *    нужен, чтобы audit-запись о блокировке делалась один раз на окно, а не на каждый
 *    запрос в окне блока.
 *  - `strike` — номер срабатывания блока по данному трекеру (1, 2, 3, …); определяет
 *    тир длительности блока (1ч → 4ч → 12ч → 24ч, NFR13).
 */
export interface EscalatingThrottlerRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
  newlyBlocked: boolean;
  strike: number;
}

/**
 * Расширение хранилища нарастающей блокировкой (Story 3.12). Базовый `increment`
 * ставит блок фиксированной длины (= окно); `incrementEscalating` при каждом новом
 * срабатывании наращивает длительность блока по таблице тиров `tiersMs`, помня
 * число страйков трекера в скользящем окне `memoryTtl` (после простоя — забывает).
 */
export interface IEscalatingRateLimitStorage extends ThrottlerStorage {
  incrementEscalating(
    key: string,
    ttl: number,
    limit: number,
    tiersMs: number[],
    memoryTtl: number,
    throttlerName: string,
  ): Promise<EscalatingThrottlerRecord>;
}
