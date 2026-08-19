import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, CurrentUser } from '@coopenomics/extension-kit';
import { ClientIp } from '~/application/auth/decorators/request-meta.decorator';
import type { PendingCriticalAction } from '~/domain/auth-v2/ports/pending-critical-actions.port';
import { AuthorizationGuard } from '../authorization/authorization.guard';
import { CheckAbility } from '../authorization/check-ability.decorator';
import { CriticalActionsService, type CriticalActionAuditEntry } from './critical-actions.service';
import { KeyRevocationService } from '../key-revocation/key-revocation.service';
import { ForceRecoveryService } from '../force-recovery/force-recovery.service';
import {
  AuthorizeForceRecoveryInputDTO,
  CriticalActionAuditEntryDTO,
  ForceRecoveryAuthorizationDTO,
  InitiateCriticalActionInputDTO,
  PendingCriticalActionDTO,
  RequestForceRecoveryConsentInputDTO,
  RevokeKeyResultDTO,
  RevokeParticipantKeyInputDTO,
} from './dto/critical-actions.dto';

interface ICurrentUser {
  id: string;
  username: string;
  role?: string;
}

function mapPending(p: PendingCriticalAction): PendingCriticalActionDTO {
  return {
    id: p.id,
    action_type: p.actionType,
    actor_id: p.actorId,
    target_id: p.targetId,
    payload: p.payload,
    status: p.status,
    confirmations: p.confirmations.map((c) => ({ by: c.by, at: c.at })),
    created_at: p.createdAt,
    expires_at: p.expiresAt,
    finalized_at: p.finalizedAt ?? null,
  };
}

/**
 * GraphQL-фасад критических действий совета (Фаза 2 миграции REST→GraphQL/SDK).
 * Заменяет REST-контроллеры `coop/critical-actions`, `coop/keys` и JWT-методы
 * `coop/force-recovery` (request-consent/authorize) — фронт ходит через
 * @coopenomics/sdk (Zeus), нового способа взаимодействия с бэкендом наружу не появляется.
 *
 * Авторизация — тот же субстрат Эпика 6: `@CheckAbility` + `AuthorizationGuard`
 * (уже GraphQL-aware), те же способности, что были на REST. Magic-link
 * `coop/force-recovery/consent/:token` остаётся REST (клик из письма без SDK-контекста).
 */
@Resolver()
export class CriticalActionsResolver {
  constructor(
    private readonly criticalActions: CriticalActionsService,
    private readonly keyRevocation: KeyRevocationService,
    private readonly forceRecovery: ForceRecoveryService,
  ) {}

  @Mutation(() => PendingCriticalActionDTO, {
    name: 'initiateCriticalAction',
    description: 'Инициировать критическое действие совета (председатель)',
  })
  @UseGuards(GqlJwtAuthGuard, AuthorizationGuard)
  @CheckAbility('create', 'CriticalAction')
  async initiateCriticalAction(
    @Args('data', { type: () => InitiateCriticalActionInputDTO }) data: InitiateCriticalActionInputDTO,
    @CurrentUser() user: ICurrentUser,
  ): Promise<PendingCriticalActionDTO> {
    const action = await this.criticalActions.initiate({
      actionType: data.action_type,
      actorId: user.username,
      targetId: data.target_id,
      payload: data.payload ?? undefined,
    });
    return mapPending(action);
  }

  @Mutation(() => PendingCriticalActionDTO, {
    name: 'confirmCriticalAction',
    description: 'Подтвердить критическое действие совета (член совета)',
  })
  @UseGuards(GqlJwtAuthGuard, AuthorizationGuard)
  @CheckAbility('confirm', 'CriticalAction')
  async confirmCriticalAction(
    @Args('id', { type: () => String }) id: string,
    @CurrentUser() user: ICurrentUser,
  ): Promise<PendingCriticalActionDTO> {
    const action = await this.criticalActions.confirm(id, user.username);
    return mapPending(action);
  }

  @Query(() => [CriticalActionAuditEntryDTO], {
    name: 'getCriticalActionAuditTrail',
    description: 'Audit-trail критических действий, затрагивающих пайщика (для контролирующего органа)',
  })
  @UseGuards(GqlJwtAuthGuard, AuthorizationGuard)
  @CheckAbility('read', 'CriticalAction')
  async getCriticalActionAuditTrail(
    @Args('target_id', { type: () => String }) targetId: string,
  ): Promise<CriticalActionAuditEntryDTO[]> {
    const entries: CriticalActionAuditEntry[] = await this.criticalActions.getAuditTrail(targetId);
    return entries.map((e) => ({
      id: e.id,
      action_type: e.actionType,
      target_id: e.targetId,
      status: e.status,
      created_at: e.createdAt,
      finalized_at: e.finalizedAt,
      initiator_id: e.initiatorId,
      initiated_at: e.initiatedAt,
      confirmer_ids: e.confirmerIds.map((c) => ({ by: c.by, at: c.at })),
      payload_hash: e.payloadHash,
    }));
  }

  @Mutation(() => RevokeKeyResultDTO, {
    name: 'revokeParticipantKey',
    description: 'Отозвать скомпрометированный ключ пайщика (председатель)',
  })
  @UseGuards(GqlJwtAuthGuard, AuthorizationGuard)
  @CheckAbility('update', 'Participant')
  async revokeParticipantKey(
    @Args('data', { type: () => RevokeParticipantKeyInputDTO }) data: RevokeParticipantKeyInputDTO,
    @CurrentUser() user: ICurrentUser,
    @ClientIp() ip: string | null,
  ): Promise<RevokeKeyResultDTO> {
    const result = await this.keyRevocation.revoke({
      targetId: data.target_id,
      reason: data.reason,
      chairmanId: user.username,
      ip,
    });
    return {
      status: result.status,
      target_id: result.targetId,
      sessions_revoked: result.sessionsRevoked,
      must_recover: result.mustRecover,
    };
  }

  @Mutation(() => Boolean, {
    name: 'requestForceRecoveryConsent',
    description: 'Запросить согласие пайщика на принудительное восстановление (председатель)',
  })
  @UseGuards(GqlJwtAuthGuard, AuthorizationGuard)
  @CheckAbility('create', 'CriticalAction')
  async requestForceRecoveryConsent(
    @Args('data', { type: () => RequestForceRecoveryConsentInputDTO }) data: RequestForceRecoveryConsentInputDTO,
    @CurrentUser() user: ICurrentUser,
    @ClientIp() ip: string | null,
  ): Promise<boolean> {
    await this.forceRecovery.requestConsent(data.target_id, user.username, ip);
    return true;
  }

  @Mutation(() => ForceRecoveryAuthorizationDTO, {
    name: 'authorizeForceRecovery',
    description: 'Авторизовать принудительное восстановление доступа пайщика (председатель)',
  })
  @UseGuards(GqlJwtAuthGuard, AuthorizationGuard)
  @CheckAbility('create', 'CriticalAction')
  async authorizeForceRecovery(
    @Args('data', { type: () => AuthorizeForceRecoveryInputDTO }) data: AuthorizeForceRecoveryInputDTO,
    @CurrentUser() user: ICurrentUser,
    @ClientIp() ip: string | null,
  ): Promise<ForceRecoveryAuthorizationDTO> {
    const auth = await this.forceRecovery.authorize({
      targetId: data.target_id,
      initiatorId: user.username,
      assemblyDecisionTxId: data.assembly_decision_tx_id ?? undefined,
      criticalActionId: data.critical_action_id ?? undefined,
      ip,
    });
    return {
      authorized: auth.authorized,
      consent_via: auth.consentVia,
      triggered_by: auth.triggeredBy,
    };
  }
}
