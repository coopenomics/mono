import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { AbstractEntitySyncService } from '../../../../shared/services/abstract-entity-sync.service';
import { ProgramPropertyDomainEntity } from '../../domain/entities/program-property.entity';
import {
  ProgramPropertyRepository,
  PROGRAM_PROPERTY_REPOSITORY,
} from '../../domain/repositories/program-property.repository';
import { ProgramPropertyDeltaMapper } from '../../infrastructure/blockchain/mappers/program-property-delta.mapper';
import type { IProgramPropertyBlockchainData } from '../../domain/interfaces/program-property-blockchain.interface';

/**
 * Сервис синхронизации программных имущественных взносов с блокчейном
 *
 * Подписывается на дельты таблицы pgproperties контракта capital
 * и синхронизирует данные программных имущественных взносов в локальной базе данных
 */
@Injectable()
export class ProgramPropertySyncService
  extends AbstractEntitySyncService<ProgramPropertyDomainEntity, IProgramPropertyBlockchainData>
  implements OnModuleInit
{
  protected readonly entityName = 'ProgramProperty';

  constructor(
    @Inject(PROGRAM_PROPERTY_REPOSITORY)
    programPropertyRepository: ProgramPropertyRepository,
    programPropertyDeltaMapper: ProgramPropertyDeltaMapper,
    logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2
  ) {
    super(programPropertyRepository, programPropertyDeltaMapper, logger);
  }

  async onModuleInit() {
    const supportedVersions = this.getSupportedVersions();
    this.logger.debug(
      `Сервис синхронизации программных имущественных взносов инициализирован. Поддерживаемые контракты: [${supportedVersions.contracts.join(
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
   * Обработчик форков для программных имущественных взносов
   */
  @OnEvent('fork::*')
  async handleProgramPropertyFork(forkData: { block_num: number }): Promise<void> {
    await this.handleFork(forkData.block_num);
  }
}
