import { Injectable } from '@nestjs/common';
import { VotingInteractor } from '../use-cases/voting.interactor';
import type { StartVotingInputDTO } from '../dto/voting/start-voting-input.dto';
import type { SubmitVoteInputDTO } from '../dto/voting/submit-vote-input.dto';
import type { CompleteVotingInputDTO } from '../dto/voting/complete-voting-input.dto';
import type { CalculateVotesInputDTO } from '../dto/voting/calculate-votes-input.dto';
import { VoteOutputDTO } from '../dto/voting/vote.dto';
import { VoteFilterInputDTO } from '../dto/voting/vote-filter.input';
import { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import { SegmentMapper } from '../../infrastructure/mappers/segment.mapper';
import { SegmentOutputDTO } from '../dto/segments/segment.dto';
import type { InnerTransactResult } from '@coopenomics/innercoop';

/**
 * Сервис уровня приложения для голосования в CAPITAL
 * Обрабатывает запросы от VotingResolver
 */
@Injectable()
export class VotingService {
  constructor(private readonly votingInteractor: VotingInteractor, private readonly segmentMapper: SegmentMapper) {}

  /**
   * Запуск голосования в CAPITAL контракте
   */
  async startVoting(data: StartVotingInputDTO): Promise<InnerTransactResult> {
    return await this.votingInteractor.startVoting(data);
  }

  /**
   * Голосование в CAPITAL контракте
   */
  async submitVote(data: SubmitVoteInputDTO, username: string): Promise<InnerTransactResult> {
    return await this.votingInteractor.submitVote({ ...data, voter: username });
  }

  /**
   * Завершение голосования в CAPITAL контракте
   */
  async completeVoting(data: CompleteVotingInputDTO): Promise<InnerTransactResult> {
    return await this.votingInteractor.completeVoting(data);
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
    const domainOptions: PaginationInputDTO | undefined = options;

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
