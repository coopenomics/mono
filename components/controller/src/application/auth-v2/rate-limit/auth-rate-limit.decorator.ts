import { SetMetadata } from '@nestjs/common';
import { AUTH_RATE_LIMIT_METADATA, type AuthRateLimitConfig } from './auth-rate-limit.types';

/**
 * Навесить двухключевой rate-limit (Story 9.1) на endpoint контура auth-v2.
 * Считывается `AuthRateLimitGuard`. Пример:
 *   `@AuthRateLimit({ ip: LOGIN_IP_RULE, account: { ...LOGIN_ACCOUNT_RULE, key: r => r.params.subject_id } })`
 */
export const AuthRateLimit = (config: AuthRateLimitConfig) => SetMetadata(AUTH_RATE_LIMIT_METADATA, config);
