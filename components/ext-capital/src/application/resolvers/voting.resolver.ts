import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { VotingService } from '../services/voting.service';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { TransactionDTO } from '~/application/common/dto/transaction-result-response.dto';
import { CalculateVotesInputDTO } from '../dto/voting/calculate-votes-input.dto';
import { CompleteVotingInputDTO } from '../dto/voting/complete-voting-input.dto';
import { StartVotingInputDTO } from '../dto/voting/start-voting-input.dto';
import { SubmitVoteInputDTO } from '../dto/voting/submit-vote-input.dto';
import { VoteOutputDTO } from '../dto/voting/vote.dto';
import { VoteFilterInputDTO } from '../dto/voting/vote-filter.input';
import { GetVoteInputDTO } from '../dto/voting/get-vote-input.dto';
import { createPaginationResult, PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { SegmentOutputDTO } from '../dto/segments/segment.dto';

// Пагинированные результаты
const paginatedVotesResult = createPaginationResult(VoteOutputDTO, 'PaginatedCapitalVotes');

/**
 * GraphQL резолвер для действий голосования CAPITAL контракта
 */
@Resolver()
export class VotingResolver {
  constructor(private readonly votingService: VotingService) {}

  /**
   * Мутация для запуска голосования в CAPITAL контракте
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalStartVoting',
    description: 'Запуск голосования в CAPITAL контракте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async StartVoting(@Args('data', { type: () => StartVotingInputDTO }) data: StartVotingInputDTO): Promise<TransactionDTO> {
    const result = await this.votingService.startVoting(data);
    return result;
  }

  /**
   * Мутация для голосования в CAPITAL контракте
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalSubmitVote',
    description: 'Голосование в CAPITAL контракте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async submitCapitalVote(
    @Args('data', { type: () => SubmitVoteInputDTO }) data: SubmitVoteInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<TransactionDTO> {
    const result = await this.votingService.submitVote(data, currentUser?.username ?? '');
    return result;
  }

  /**
   * Мутация для завершения голосования в CAPITAL контракте
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalCompleteVoting',
    description: 'Завершение голосования в CAPITAL контракте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async completeCapitalVoting(
    @Args('data', { type: () => CompleteVotingInputDTO }) data: CompleteVotingInputDTO
  ): Promise<TransactionDTO> {
    const result = await this.votingService.completeVoting(data);
    return result;
  }

  /**
   * Мутация для расчета голосов в CAPITAL контракте
   */
  @Mutation(() => SegmentOutputDTO, {
    name: 'capitalCalculateVotes',
    description: 'Расчет голосов в CAPITAL контракте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async calculateCapitalVotes(
    @Args('data', { type: () => CalculateVotesInputDTO }) data: CalculateVotesInputDTO
  ): Promise<SegmentOutputDTO> {
    const result = await this.votingService.calculateVotes(data);
    return result;
  }

  // ============ ЗАПРОСЫ ГОЛОСОВ ============

  /**
   * Получение всех голосов с фильтрацией
   */
  @Query(() => paginatedVotesResult, {
    name: 'capitalVotes',
    description: 'Получение списка голосов кооператива с фильтрацией',
  })
  async getVotes(
    @Args('filter', { nullable: true }) filter?: VoteFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<VoteOutputDTO>> {
    return await this.votingService.getVotes(filter, options);
  }

  /**
   * Получение голоса по ID
   */
  @Query(() => VoteOutputDTO, {
    name: 'capitalVote',
    description: 'Получение голоса по внутреннему ID базы данных',
    nullable: true,
  })
  async getVote(@Args('data') data: GetVoteInputDTO): Promise<VoteOutputDTO | null> {
    return await this.votingService.getVoteById(data._id);
  }
}
