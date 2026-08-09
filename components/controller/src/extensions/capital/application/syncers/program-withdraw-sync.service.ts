import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { AbstractEntitySyncService } from '@coopenomics/extension-kit/sync';
import { ProgramWithdrawDomainEntity } from '../../domain/entities/program-withdraw.entity';
import {
  ProgramWithdrawRepository,
  PROGRAM_WITHDRAW_REPOSITORY,
} from '../../domain/repositories/program-withdraw.repository';
import { ProgramWithdrawDeltaMapper } from '../../infrastructure/blockchain/mappers/program-withdraw-delta.mapper';
import type { IProgramWithdrawBlockchainData } from '../../domain/interfaces/program-withdraw-blockchain.interface';

/**
 * Сервис синхронизации возвратов из программы с блокчейном
 *
 * Подписывается на дельты таблицы prgwithdraws контракта capital
 * и синхронизирует данные возвратов из программы в локальной базе данных
 */
@Injectable()
export class ProgramWithdrawSyncService
  extends AbstractEntitySyncService<ProgramWithdrawDomainEntity, IProgramWithdrawBlockchainData>
  implements OnModuleInit
{
  protected readonly entityName = 'ProgramWithdraw';

  constructor(
    @Inject(PROGRAM_WITHDRAW_REPOSITORY)
    programWithdrawRepository: ProgramWithdrawRepository,
    programWithdrawDeltaMapper: ProgramWithdrawDeltaMapper,
    @Inject(LOGGER_PORT) logger: ILoggerPort,
    private readonly eventEmitter: EventEmitter2
  ) {
    super(programWithdrawRepository, programWithdrawDeltaMapper, logger);
  }

  async onModuleInit() {
    const supportedVersions = this.getSupportedVersions();
    this.logger.debug(
      `Сервис синхронизации возвратов из программы инициализирован. Поддерживаемые контракты: [${supportedVersions.contracts.join(
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
   * Обработчик форков для возвратов из программы
   */
  @OnEvent('fork::*')
  async handleProgramWithdrawFork(forkData: { block_num: number }): Promise<void> {
    await this.handleFork(forkData.block_num);
  }
}
