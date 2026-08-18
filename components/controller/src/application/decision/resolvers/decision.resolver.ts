import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, TransactionDTO } from '@coopenomics/extension-kit';
import { DecisionService } from '../services/decision.service';
import { AuthorizeDecisionInputDTO } from '../dto/authorize-decision-input.dto';
import { DeclineDecisionInputDTO } from '../dto/decline-decision-input.dto';

@Resolver()
export class DecisionResolver {
  constructor(private readonly decisionService: DecisionService) {}

  @Mutation(() => TransactionDTO, {
    name: 'authorizeDecision',
    description: 'Утвердить и исполнить решение совета',
  })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async authorizeDecision(
    @Args('data', { type: () => AuthorizeDecisionInputDTO }) data: AuthorizeDecisionInputDTO
  ): Promise<TransactionDTO> {
    return this.decisionService.authorizeDecision(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'declineDecision',
    description: 'Отклонить решение совета по отрицательному консенсусу (большинство голосов против)',
  })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async declineDecision(
    @Args('data', { type: () => DeclineDecisionInputDTO }) data: DeclineDecisionInputDTO
  ): Promise<TransactionDTO> {
    return this.decisionService.declineDecision(data);
  }
}
