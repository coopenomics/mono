import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { AbstractEntitySyncService } from '../../../../shared/services/abstract-entity-sync.service';
import { StateDomainEntity } from '../../domain/entities/state.entity';
import { StateRepository, STATE_REPOSITORY } from '../../domain/repositories/state.repository';
import { StateDeltaMapper } from '../../infrastructure/blockchain/mappers/state-delta.mapper';
import type { IStateBlockchainData } from '../../domain/interfaces/state-blockchain.interface';

/**
 * Сервис синхронизации состояния кооператива с блокчейном
 *
 * Подписывается на дельты таблицы state контракта capital
 * и синхронизирует данные состояния в локальной базе данных
 */
@Injectable()
export class StateSyncService
  extends AbstractEntitySyncService<StateDomainEntity, IStateBlockchainData>
  implements OnModuleInit
{
  protected readonly entityName = 'State';

  constructor(
    @Inject(STATE_REPOSITORY)
    stateRepository: StateRepository,
    stateDeltaMapper: StateDeltaMapper,
    logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2
  ) {
    super(stateRepository, stateDeltaMapper, logger);
  }

  async onModuleInit() {
    const supportedVersions = this.getSupportedVersions();
    this.logger.debug(
      `Сервис синхронизации состояния инициализирован. Поддерживаемые контракты: [${supportedVersions.contracts.join(
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

    this.logger.debug('Сервис синхронизации состояния полностью инициализирован с подписками на паттерны');
  }

  /**
   * Обработка форков для состояния
   * Теперь подписывается на все форки независимо от контракта
   */
  @OnEvent('fork::*')
  async handleStateFork(forkData: { block_num: number }): Promise<void> {
    await this.handleFork(forkData.block_num);
  }
}
