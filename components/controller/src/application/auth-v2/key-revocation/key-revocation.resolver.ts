import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, CurrentUser } from '@coopenomics/extension-kit';
import { ClientIp } from '~/application/auth/decorators/request-meta.decorator';
import { AuthorizationGuard } from '../authorization/authorization.guard';
import { CheckAbility } from '../authorization/check-ability.decorator';
import { KeyRevocationService } from './key-revocation.service';
import { KeyRevocationStatus, RevokeKeyResultDTO, RevokeParticipantKeyInputDTO } from './dto/key-revocation.dto';

interface ICurrentUser {
  id: string;
  username: string;
  role?: string;
}

/** Отзыв скомпрометированного ключа пайщика председателем. */
@Resolver()
export class KeyRevocationResolver {
  constructor(private readonly keyRevocation: KeyRevocationService) {}

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
      status: KeyRevocationStatus.Revoked,
      target_id: result.targetId,
      sessions_revoked: result.sessionsRevoked,
      must_recover: result.mustRecover,
    };
  }
}
