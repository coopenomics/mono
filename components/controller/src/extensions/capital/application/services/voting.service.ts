import { Injectable, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { PUB_SUB } from '~/infrastructure/pubsub/pubsub.module';
import { CAPITAL_EVENTS } from '../resolvers/capital-subscription.resolver';
import { VotingInteractor } from '../use-cases/voting.interactor';
import type { StartVotingInputDTO } from '../dto/voting/start-voting-input.dto';
import type { SubmitVoteInputDTO } from '../dto/voting/submit-vote-input.dto';
import type { CompleteVotingInputDTO } from '../dto/voting/complete-voting-input.dto';
import type { CalculateVotesInputDTO } from '../dto/voting/calculate-votes-input.dto';
import type { TransactResult } from '@wharfkit/session';
import { VoteOutputDTO } from '../dto/voting/vote.dto';
import { VoteFilterInputDTO } from '../dto/voting/vote-filter.input';
import { PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import type { PaginationInputDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import { SegmentMapper } from '../../infrastructure/mappers/segment.mapper';
import { SegmentOutputDTO } from '../dto/segments/segment.dto';

@Injectable()
export class VotingService {
  constructor(
    private readonly votingInteractor: VotingInteractor,
    private readonly segmentMapper: SegmentMapper,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  private notifyDataChanged(entity: string, action: string) {
    this.pubSub.publish(CAPITAL_EVENTS.DATA_CHANGED, {
      [CAPITAL_EVENTS.DATA_CHANGED]: { entity, action },
    });
  }

  /**
   * Запуск голосования в CAPITAL контракте
   */
  async startVoting(data: StartVotingInputDTO): Promise<TransactResult> {
    const result = await this.votingInteractor.startVoting(data);
    this.notifyDataChanged('voting', 'started');
    return result;
  }

  /**
   * Голосование в CAPITAL контракте
   */
  async submitVote(data: SubmitVoteInputDTO, username: string): Promise<TransactResult> {
    const result = await this.votingInteractor.submitVote({ ...data, voter: username });
    this.notifyDataChanged('voting', 'voted');
    return result;
  }

  /**
   * Завершение голосования в CAPITAL контракте
   */
  async completeVoting(data: CompleteVotingInputDTO): Promise<TransactResult> {
    const result = await this.votingInteractor.completeVoting(data);
    this.notifyDataChanged('voting', 'completed');
    return result;
  }

  /**
   * Расчет голосов в CAPITAL контракте
   */
  async calculateVotes(data: CalculateVotesInputDTO): Promise<SegmentOutputDTO> {
    const segmentEntity = await this.votingInteractor.calculateVotes(data);
    return await this.segmentMapper.toDTO(segmentEntity);
  }

  // ============ МЕТОДЫ ЧТЕНИЯ ДАННЫХ ============

  /**
   * Получение всех голосов
   */
  async getVotes(filter?: VoteFilterInputDTO, options?: PaginationInputDTO): Promise<PaginationResult<VoteOutputDTO>> {
    // Конвертируем параметры пагинации в доменные
    const domainOptions: PaginationInputDomainInterface | undefined = options;

    // Получаем результат с пагинацией из домена
    const result = await this.votingInteractor.getVotes(filter, domainOptions);

    // Конвертируем результат в DTO
    return {
      items: result.items as VoteOutputDTO[],
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }

  /**
   * Получение голоса по ID
   */
  async getVoteById(_id: string): Promise<VoteOutputDTO | null> {
    const vote = await this.votingInteractor.getVoteById(_id);
    return vote as VoteOutputDTO | null;
  }
}
