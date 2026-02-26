import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { AbstractEntitySyncService } from '../../../../shared/services/abstract-entity-sync.service';
import { DebtDomainEntity } from '../../domain/entities/debt.entity';
import { DebtRepository, DEBT_REPOSITORY } from '../../domain/repositories/debt.repository';
import { DebtDeltaMapper } from '../../infrastructure/blockchain/mappers/debt-delta.mapper';
import type { IDebtBlockchainData } from '../../domain/interfaces/debt-blockchain.interface';

/**
 * Сервис синхронизации долгов с блокчейном
 *
 * Подписывается на дельты таблицы debts контракта capital
 * и синхронизирует данные долгов в локальной базе данных
 */
@Injectable()
export class DebtSyncService
  extends AbstractEntitySyncService<DebtDomainEntity, IDebtBlockchainData>
  implements OnModuleInit
{
  protected readonly entityName = 'Debt';

  constructor(
    @Inject(DEBT_REPOSITORY)
    debtRepository: DebtRepository,
    debtDeltaMapper: DebtDeltaMapper,
    logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2
  ) {
    super(debtRepository, debtDeltaMapper, logger);
  }

  async onModuleInit() {
    const supportedVersions = this.getSupportedVersions();
    this.logger.debug(
      `Сервис синхронизации долгов инициализирован. Поддерживаемые контракты: [${supportedVersions.contracts.join(
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

    this.logger.debug('Сервис синхронизации долгов полностью инициализирован с подписками на паттерны');
  }

  /**
   * Обработка форков для долгов
   * Теперь подписывается на все форки независимо от контракта
   */
  @OnEvent('fork::*')
  async handleDebtFork(forkData: { block_num: number }): Promise<void> {
    await this.handleFork(forkData.block_num);
  }
}
