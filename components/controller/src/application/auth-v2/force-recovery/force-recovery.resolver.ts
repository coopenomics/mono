import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, CurrentUser } from '@coopenomics/extension-kit';
import { ClientIp } from '~/application/auth/decorators/request-meta.decorator';
import { AuthorizationGuard } from '../authorization/authorization.guard';
import { CheckAbility } from '../authorization/check-ability.decorator';
import { ForceRecoveryService } from './force-recovery.service';
import {
  AuthorizeForceRecoveryInputDTO,
  ForceRecoveryAuthorizationDTO,
  RequestForceRecoveryConsentInputDTO,
} from './dto/force-recovery.dto';

interface ICurrentUser {
  id: string;
  username: string;
  role?: string;
}

/**
 * Принудительное восстановление доступа пайщика председателем. Ссылка согласия из
 * письма пайщику (`coop/force-recovery/consent/:token`) остаётся REST — клик без
 * контекста SDK.
 */
@Resolver()
export class ForceRecoveryResolver {
  constructor(private readonly forceRecovery: ForceRecoveryService) {}

  @Mutation(() => Boolean, {
    name: 'requestForceRecoveryConsent',
    description: 'Запросить согласие пайщика на принудительное восстановление (председатель)',
  })
  @UseGuards(GqlJwtAuthGuard, AuthorizationGuard)
  @CheckAbility('update', 'Participant')
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
  @CheckAbility('update', 'Participant')
  async authorizeForceRecovery(
    @Args('data', { type: () => AuthorizeForceRecoveryInputDTO }) data: AuthorizeForceRecoveryInputDTO,
    @CurrentUser() user: ICurrentUser,
    @ClientIp() ip: string | null,
  ): Promise<ForceRecoveryAuthorizationDTO> {
    const auth = await this.forceRecovery.authorize({
      targetId: data.target_id,
      initiatorId: user.username,
      assemblyDecisionTxId: data.assembly_decision_tx_id ?? undefined,
      ip,
    });
    return {
      authorized: auth.authorized,
      consent_via: auth.consentVia,
      triggered_by: auth.triggeredBy,
    };
  }
}
