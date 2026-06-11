import { Module } from '@nestjs/common';
import { AbilityFactory } from './ability.factory';

/**
 * CASL-авторизация auth-v2 (Эпик 6). Story 6.1 — `AbilityFactory` (Layer 1).
 * Растёт: Layer 2 (`access_rules`, 6.2), Layer 3 (PolicyHandler, 6.3), единый
 * `AuthorizationGuard` (6.4) — потребитель Ability.
 */
@Module({
  providers: [AbilityFactory],
  exports: [AbilityFactory],
})
export class AuthorizationModule {}
