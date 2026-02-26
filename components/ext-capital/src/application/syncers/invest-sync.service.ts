import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { AbstractEntitySyncService } from '../../../../shared/services/abstract-entity-sync.service';
import { InvestDomainEntity } from '../../domain/entities/invest.entity';
import { InvestRepository, INVEST_REPOSITORY } from '../../domain/repositories/invest.repository';
import { InvestDeltaMapper } from '../../infrastructure/blockchain/mappers/invest-delta.mapper';
import type { IInvestBlockchainData } from '../../domain/interfaces/invest-blockchain.interface';

/**
 * Сервис синхронизации инвестиций с блокчейном
 *
 * Подписывается на дельты таблицы invests контракта capital
 * и синхронизирует данные инвестиций в локальной базе данных
 */
@Injectable()
export class InvestSyncService
  extends AbstractEntitySyncService<InvestDomainEntity, IInvestBlockchainData>
  implements OnModuleInit
{
  protected readonly entityName = 'Invest';

  constructor(
    @Inject(INVEST_REPOSITORY)
    investRepository: InvestRepository,
    investDeltaMapper: InvestDeltaMapper,
    logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2
  ) {
    super(investRepository, investDeltaMapper, logger);
  }

  async onModuleInit() {
    const supportedVersions = this.getSupportedVersions();
    this.logger.debug(
      `Сервис синхронизации инвестиций инициализирован. Поддерживаемые контракты: [${supportedVersions.contracts.join(
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

    this.logger.debug('Сервис синхронизации инвестиций полностью инициализирован с подписками на паттерны');
  }

  /**
   * Обработка форков для инвестиций
   * Теперь подписывается на все форки независимо от контракта
   */
  @OnEvent('fork::*')
  async handleInvestFork(forkData: { block_num: number }): Promise<void> {
    await this.handleFork(forkData.block_num);
  }
}
