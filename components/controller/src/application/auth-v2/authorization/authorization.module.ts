import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { AuthV2InfrastructureModule } from '~/infrastructure/auth-v2/auth-v2-infrastructure.module';
import { AbilityFactory } from './ability.factory';
import { PolicyRegistry } from './policy.registry';
import { SameCoopVotingPolicy } from './policies/same-coop-voting.policy';

/**
 * CASL-авторизация auth-v2 (Эпик 6). Story 6.1 — `AbilityFactory` (Layer 1);
 * Story 6.2 — Layer 2 (`access_rules`, репозиторий из инфра-модуля); Story 6.3 —
 * Layer 3 (`PolicyRegistry` + политики `@PolicyHandler`, через `DiscoveryModule`).
 * Растёт: единый `AuthorizationGuard` (6.4) — потребитель Ability + реестра политик.
 */
@Module({
  imports: [DiscoveryModule, AuthV2InfrastructureModule],
  providers: [AbilityFactory, PolicyRegistry, SameCoopVotingPolicy],
  exports: [AbilityFactory, PolicyRegistry],
})
export class AuthorizationModule {}
