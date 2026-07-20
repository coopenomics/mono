import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { TransactionDTO } from '~/application/common/dto/transaction-result-response.dto';
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
