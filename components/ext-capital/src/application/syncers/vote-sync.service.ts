import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { AbstractEntitySyncService } from '../../../../shared/services/abstract-entity-sync.service';
import { VoteDomainEntity } from '../../domain/entities/vote.entity';
import { VoteRepository, VOTE_REPOSITORY } from '../../domain/repositories/vote.repository';
import { VoteDeltaMapper } from '../../infrastructure/blockchain/mappers/vote-delta.mapper';
import type { IVoteBlockchainData } from '../../domain/interfaces/vote-blockchain.interface';

/**
 * Сервис синхронизации голосов с блокчейном
 *
 * Подписывается на дельты таблицы votes контракта capital
 * и синхронизирует данные голосов в локальной базе данных
 */
@Injectable()
export class VoteSyncService
  extends AbstractEntitySyncService<VoteDomainEntity, IVoteBlockchainData>
  implements OnModuleInit
{
  protected readonly entityName = 'Vote';

  constructor(
    @Inject(VOTE_REPOSITORY)
    voteRepository: VoteRepository,
    voteDeltaMapper: VoteDeltaMapper,
    logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2
  ) {
    super(voteRepository, voteDeltaMapper, logger);
  }

  async onModuleInit() {
    const supportedVersions = this.getSupportedVersions();
    this.logger.debug(
      `Сервис синхронизации голосов инициализирован. Поддерживаемые контракты: [${supportedVersions.contracts.join(
        ', '
      )}], таблицы: [${supportedVersions.tables.join(', ')}]`
    );

    // Программная подписка на все поддерживаемые паттерны событий
    const allPatterns = this.getAllEventPatterns();
    this.logger.debug(`Подписка на ${allPatterns.length} паттернов событий: ${allPatterns.join(', ')}`);

    // Подписываемся на каждый паттерн программно
    allPatterns.forEach((pattern) => {
      this.eventEmitter.on(pattern, this.processDelta.bind(this));
    });

    this.logger.debug('Сервис синхронизации голосов полностью инициализирован с подписками на паттерны');
  }

  /**
   * Обработка форков для голосов
   * Теперь подписывается на все форки независимо от контракта
   */
  @OnEvent('fork::*')
  async handleVoteFork(forkData: { block_num: number }): Promise<void> {
    await this.handleFork(forkData.block_num);
  }
}
