import { Injectable, Inject, Logger } from '@nestjs/common';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import type { TransactResult } from '@wharfkit/session';
import type { StartVotingDomainInput } from '../../domain/actions/start-voting-domain-input.interface';
import type { SubmitVoteDomainInput } from '../../domain/actions/submit-vote-domain-input.interface';
import type { CompleteVotingDomainInput } from '../../domain/actions/complete-voting-domain-input.interface';
import type { CalculateVotesDomainInput } from '../../domain/actions/calculate-votes-domain-input.interface';
import { VOTE_REPOSITORY, VoteRepository } from '../../domain/repositories/vote.repository';
import { VoteDomainEntity } from '../../domain/entities/vote.entity';
import { SegmentDomainEntity } from '../../domain/entities/segment.entity';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { VoteFilterInputDTO } from '../dto/voting/vote-filter.input';
import { SegmentSyncService } from '../syncers/segment-sync.service';

/**
 * Интерактор домена для голосования в CAPITAL контракте
 * Обрабатывает действия связанные с процессом голосования
 */
@Injectable()
export class VotingInteractor {
  constructor(
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly capitalBlockchainPort: CapitalBlockchainPort,
    @Inject(VOTE_REPOSITORY)
    private readonly voteRepository: VoteRepository,
    private readonly segmentSyncService: SegmentSyncService
  ) {
    this.logger = new Logger(VotingInteractor.name);
  }

  private readonly logger: Logger;

  /**
   * Запуск голосования в CAPITAL контракте
   */
  async startVoting(data: StartVotingDomainInput): Promise<TransactResult> {
    // Вызываем блокчейн порт
    return await this.capitalBlockchainPort.startVoting(data);
  }

  /**
   * Голосование в CAPITAL контракте
   */
  async submitVote(data: SubmitVoteDomainInput): Promise<TransactResult> {
    // Вызываем блокчейн порт
    return await this.capitalBlockchainPort.submitVote(data);
  }

  /**
   * Завершение голосования в CAPITAL контракте
   */
  async completeVoting(data: CompleteVotingDomainInput): Promise<TransactResult> {
    // Вызываем блокчейн порт
    return await this.capitalBlockchainPort.completeVoting(data);
  }

  /**
   * Расчет голосов в CAPITAL контракте
   */
  async calculateVotes(data: CalculateVotesDomainInput): Promise<SegmentDomainEntity> {
    // Вызываем блокчейн порт
    const transactResult = await this.capitalBlockchainPort.calculateVotes(data);

    // Синхронизируем сегмент
    const segmentEntity = await this.segmentSyncService.syncSegment(
      data.coopname,
      data.project_hash,
      data.username,
      transactResult
    );

    if (!segmentEntity) {
      throw new Error(`Не удалось синхронизировать сегмент ${data.project_hash}:${data.username} после расчета голосов`);
    }

    // Возвращаем обновленную сущность сегмента
    return segmentEntity;
  }

  // ============ МЕТОДЫ ЧТЕНИЯ ДАННЫХ ============

  /**
   * Получение всех голосов
   */
  async getVotes(
    filter?: VoteFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<VoteDomainEntity>> {
    return await this.voteRepository.findAllPaginated(filter, options);
  }

  /**
   * Получение голоса по ID
   */
  async getVoteById(_id: string): Promise<VoteDomainEntity | null> {
    return await this.voteRepository.findById(_id);
  }
}
