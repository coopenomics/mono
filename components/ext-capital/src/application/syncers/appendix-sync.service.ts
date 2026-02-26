import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { AbstractEntitySyncService } from '../../../../shared/services/abstract-entity-sync.service';
import { AppendixDomainEntity } from '../../domain/entities/appendix.entity';
import { AppendixRepository, APPENDIX_REPOSITORY } from '../../domain/repositories/appendix.repository';
import { AppendixDeltaMapper } from '../../infrastructure/blockchain/mappers/appendix-delta.mapper';
import type { IAppendixBlockchainData } from '../../domain/interfaces/appendix-blockchain.interface';
import { ClearanceManagementInteractor } from '../use-cases/clearance-management.interactor';
import { CapitalContract } from 'cooptypes';
import { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';

/**
 * Сервис синхронизации приложений с блокчейном
 *
 * Подписывается на дельты таблицы appendixes контракта capital
 * и синхронизирует данные приложений в локальной базе данных
 */
@Injectable()
export class AppendixSyncService
  extends AbstractEntitySyncService<AppendixDomainEntity, IAppendixBlockchainData>
  implements OnModuleInit
{
  protected readonly entityName = 'Appendix';

  constructor(
    @Inject(APPENDIX_REPOSITORY)
    appendixRepository: AppendixRepository,
    appendixDeltaMapper: AppendixDeltaMapper,
    logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2,
    private readonly clearanceManagementInteractor: ClearanceManagementInteractor
  ) {
    super(appendixRepository, appendixDeltaMapper, logger);
  }

  async onModuleInit() {
    const supportedVersions = this.getSupportedVersions();
    this.logger.debug(
      `Сервис синхронизации допусков инициализирован. Поддерживаемые контракты: [${supportedVersions.contracts.join(
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
   * Обработчик одобрения приложения
   */
  @OnEvent(`action::${CapitalContract.contractName.production}::${CapitalContract.Actions.ConfirmClearance.actionName}`)
  async handleConfirmClearance(actionData: ActionDomainInterface): Promise<void> {
    try {
      await this.clearanceManagementInteractor.handleConfirmClearance(actionData);
    } catch (error: any) {
      this.logger.error(`Ошибка при обработке одобрения приложения: ${error?.message}`, error?.stack);
    }
  }

  /**
   * Обработчик отклонения приложения
   */
  @OnEvent(`action::${CapitalContract.contractName.production}::${CapitalContract.Actions.DeclineClearance.actionName}`)
  async handleDeclineClearance(actionData: ActionDomainInterface): Promise<void> {
    try {
      await this.clearanceManagementInteractor.handleDeclineClearance(actionData);
    } catch (error: any) {
      this.logger.error(`Ошибка при обработке отклонения приложения: ${error?.message}`, error?.stack);
    }
  }

  /**
   * Обработчик форков для приложений
   */
  @OnEvent('fork::*')
  async handleAppendixFork(forkData: { block_num: number }): Promise<void> {
    await this.handleFork(forkData.block_num);
  }
}
