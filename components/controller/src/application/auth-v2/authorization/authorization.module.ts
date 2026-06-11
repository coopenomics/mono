import { Module } from '@nestjs/common';
import { AuthV2InfrastructureModule } from '~/infrastructure/auth-v2/auth-v2-infrastructure.module';
import { AbilityFactory } from './ability.factory';

/**
 * CASL-авторизация auth-v2 (Эпик 6). Story 6.1 — `AbilityFactory` (Layer 1);
 * Story 6.2 — Layer 2 (`access_rules`, репозиторий из инфра-модуля). Растёт:
 * Layer 3 (PolicyHandler, 6.3), единый `AuthorizationGuard` (6.4) — потребитель Ability.
 */
@Module({
  imports: [AuthV2InfrastructureModule],
  providers: [AbilityFactory],
  exports: [AbilityFactory],
})
export class AuthorizationModule {}
