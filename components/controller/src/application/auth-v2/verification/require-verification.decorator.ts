import { SetMetadata } from '@nestjs/common';

/** Ключ метаданных action_code для `VerificationRuleGuard` (Story 4.2). */
export const REQUIRE_VERIFICATION_METADATA = 'auth-v2:require-verification';

/**
 * Потребовать на endpoint'е достаточный уровень верификации пайщика (Story 4.2).
 * `actionCode` — открытый идентификатор действия; обязательные для него типы берутся
 * из per-coop `verification_rules`. Считывается `VerificationRuleGuard`. Endpoint
 * обязан также нести `@UseGuards(HttpJwtAuthGuard, VerificationRuleGuard)` (источник
 * `req.user`) и `@UseFilters(AuthV2ExceptionFilter)` (перевод отказа в 403). Пример:
 *   `@RequireVerification('council_vote')`
 */
export const RequireVerification = (actionCode: string) =>
  SetMetadata(REQUIRE_VERIFICATION_METADATA, actionCode);
