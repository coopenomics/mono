import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { AbstractEntitySyncService } from '../../../../shared/services/abstract-entity-sync.service';
import { ProgramInvestDomainEntity } from '../../domain/entities/program-invest.entity';
import { ProgramInvestRepository, PROGRAM_INVEST_REPOSITORY } from '../../domain/repositories/program-invest.repository';
import { ProgramInvestDeltaMapper } from '../../infrastructure/blockchain/mappers/program-invest-delta.mapper';
import type { IProgramInvestBlockchainData } from '../../domain/interfaces/program-invest-blockchain.interface';

/**
 * Сервис синхронизации программных инвестиций с блокчейном
 *
 * Подписывается на дельты таблицы progrinvests контракта capital
 * и синхронизирует данные программных инвестиций в локальной базе данных
 */
@Injectable()
export class ProgramInvestSyncService
  extends AbstractEntitySyncService<ProgramInvestDomainEntity, IProgramInvestBlockchainData>
  implements OnModuleInit
{
  protected readonly entityName = 'ProgramInvest';

  constructor(
    @Inject(PROGRAM_INVEST_REPOSITORY)
    programInvestRepository: ProgramInvestRepository,
    programInvestDeltaMapper: ProgramInvestDeltaMapper,
    logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2
  ) {
    super(programInvestRepository, programInvestDeltaMapper, logger);
  }

  async onModuleInit() {
    const supportedVersions = this.getSupportedVersions();
    this.logger.debug(
      `Сервис синхронизации программных инвестиций инициализирован. Поддерживаемые контракты: [${supportedVersions.contracts.join(
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
  }

  /**
   * Обработчик форков для программных инвестиций
   */
  @OnEvent('fork::*')
  async handleProgramInvestFork(forkData: { block_num: number }): Promise<void> {
    await this.handleFork(forkData.block_num);
  }
}
