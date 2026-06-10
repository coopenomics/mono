/**
 * Порт хранилища счётчиков rate-limit контура auth-v2 (CoopID, Story 9.1).
 * Реализация (infrastructure) — поверх Redis: счётчик переживает рестарт и общий
 * для нескольких инстансов controller'а. application/guard знают только токен;
 * сам контракт — `ThrottlerStorage` из `@nestjs/throttler` (адаптер его implements),
 * чтобы переиспользовать проверенную семантику increment/TTL/block.
 */
export const RATE_LIMIT_STORAGE = Symbol('RateLimitStorage');
