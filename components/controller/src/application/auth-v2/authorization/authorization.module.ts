import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { AuthV2InfrastructureModule } from '~/infrastructure/auth-v2/auth-v2-infrastructure.module';
import { AbilityFactory } from './ability.factory';
import { PolicyRegistry } from './policy.registry';
import { PolicyService } from './policy.service';
import { AuthorizationGuard } from './authorization.guard';
import { AccessRulesCleanupService } from './access-rules-cleanup.service';
import { SameCoopVotingPolicy } from './policies/same-coop-voting.policy';

/**
 * CASL-авторизация auth-v2 (Эпик 6). Story 6.1 — `AbilityFactory` (Layer 1);
 * Story 6.2 — Layer 2 (`access_rules`); Story 6.3 — Layer 3 (`PolicyRegistry` +
 * политики `@PolicyHandler`); Story 6.4 — `PolicyService` (общий вычислитель L1–L4)
 * + единый `AuthorizationGuard` (REST + GraphQL). Резолверы переходят на
 * `@CheckAbility`+guard в Story 6.5.
 */
@Module({
  imports: [DiscoveryModule, AuthV2InfrastructureModule],
  providers: [AbilityFactory, PolicyRegistry, PolicyService, AuthorizationGuard, AccessRulesCleanupService, SameCoopVotingPolicy],
  exports: [AbilityFactory, PolicyRegistry, PolicyService, AuthorizationGuard],
})
export class AuthorizationModule {}
