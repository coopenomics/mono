import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { AbstractEntitySyncService } from '../../../../shared/services/abstract-entity-sync.service';
import { ProgramExpenseDomainEntity } from '../../domain/entities/program-expense.entity';
import {
  ProgramExpenseRepository,
  PROGRAM_EXPENSE_REPOSITORY,
} from '../../domain/repositories/program-expense.repository';
import { ProgramExpenseDeltaMapper } from '../../infrastructure/blockchain/mappers/program-expense-delta.mapper';
import type { IProgramExpenseBlockchainData } from '../../domain/interfaces/program-expense-blockchain.interface';

/**
 * Сервис синхронизации программных расходов «Благорост» (таблица progexpenses).
 */
@Injectable()
export class ProgramExpenseSyncService
  extends AbstractEntitySyncService<ProgramExpenseDomainEntity, IProgramExpenseBlockchainData>
  implements OnModuleInit
{
  protected readonly entityName = 'ProgramExpense';

  constructor(
    @Inject(PROGRAM_EXPENSE_REPOSITORY)
    repository: ProgramExpenseRepository,
    deltaMapper: ProgramExpenseDeltaMapper,
    logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(repository, deltaMapper, logger);
  }

  async onModuleInit() {
    const supportedVersions = this.getSupportedVersions();
    this.logger.debug(
      `Сервис синхронизации программных расходов инициализирован. Контракты: [${supportedVersions.contracts.join(
        ', ',
      )}], таблицы: [${supportedVersions.tables.join(', ')}]`,
    );

    const allPatterns = this.getAllEventPatterns();
    this.logger.debug(`Подписка на ${allPatterns.length} паттернов: ${allPatterns.join(', ')}`);

    allPatterns.forEach((pattern) => {
      this.eventEmitter.on(pattern, this.processDelta.bind(this));
    });
  }

  @OnEvent('fork::*')
  async handleProgramExpenseFork(forkData: { block_num: number }): Promise<void> {
    await this.handleFork(forkData.block_num);
  }
}
