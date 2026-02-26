import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { AbstractEntitySyncService } from '../../../../shared/services/abstract-entity-sync.service';
import { ExpenseDomainEntity } from '../../domain/entities/expense.entity';
import { ExpenseRepository, EXPENSE_REPOSITORY } from '../../domain/repositories/expense.repository';
import { ExpenseDeltaMapper } from '../../infrastructure/blockchain/mappers/expense-delta.mapper';
import type { IExpenseBlockchainData } from '../../domain/interfaces/expense-blockchain.interface';

/**
 * Сервис синхронизации расходов с блокчейном
 *
 * Подписывается на дельты таблицы expenses контракта capital
 * и синхронизирует данные расходов в локальной базе данных
 */
@Injectable()
export class ExpenseSyncService
  extends AbstractEntitySyncService<ExpenseDomainEntity, IExpenseBlockchainData>
  implements OnModuleInit
{
  protected readonly entityName = 'Expense';

  constructor(
    @Inject(EXPENSE_REPOSITORY)
    expenseRepository: ExpenseRepository,
    expenseDeltaMapper: ExpenseDeltaMapper,
    logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2
  ) {
    super(expenseRepository, expenseDeltaMapper, logger);
  }

  async onModuleInit() {
    const supportedVersions = this.getSupportedVersions();
    this.logger.debug(
      `Сервис синхронизации расходов инициализирован. Поддерживаемые контракты: [${supportedVersions.contracts.join(
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

    this.logger.debug('Сервис синхронизации расходов полностью инициализирован с подписками на паттерны');
  }

  /**
   * Обработка форков для расходов
   * Теперь подписывается на все форки независимо от контракта
   */
  @OnEvent('fork::*')
  async handleExpenseFork(forkData: { block_num: number }): Promise<void> {
    await this.handleFork(forkData.block_num);
  }
}
