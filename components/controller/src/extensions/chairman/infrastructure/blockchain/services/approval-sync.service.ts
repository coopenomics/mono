import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { IDelta } from '~/types/common';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { AbstractEntitySyncService } from '../../../../../shared/services/abstract-entity-sync.service';
import { ApprovalDomainEntity } from '../../../domain/entities/approval.entity';
import { ApprovalRepository, APPROVAL_REPOSITORY } from '../../../domain/repositories/approval.repository';
import { ApprovalDeltaMapper } from '../mappers/approval-delta.mapper';
import type { IApprovalBlockchainData } from '../../../domain/interfaces/approval-blockchain.interface';

/**
 * Сервис синхронизации одобрений с блокчейном
 *
 * Подписывается на дельты таблицы approvals контракта soviet
 * и синхронизирует данные одобрений в локальной базе данных
 */
@Injectable()
export class ApprovalSyncService
  extends AbstractEntitySyncService<ApprovalDomainEntity, IApprovalBlockchainData>
  implements OnModuleInit
{
  protected readonly entityName = 'Approval';

  constructor(
    @Inject(APPROVAL_REPOSITORY)
    approvalRepository: ApprovalRepository,
    approvalDeltaMapper: ApprovalDeltaMapper,
    logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2
  ) {
    super(approvalRepository, approvalDeltaMapper, logger);
  }

  async onModuleInit() {
    const supportedVersions = this.getSupportedVersions();
    this.logger.log(
      `Approval sync service initialized. Supporting contracts: [${supportedVersions.contracts.join(
        ', '
      )}], tables: [${supportedVersions.tables.join(', ')}]`
    );

    // Программная подписка на все поддерживаемые паттерны событий
    const allPatterns = this.getAllEventPatterns();
    this.logger.log(`Subscribing to ${allPatterns.length} event patterns: ${allPatterns.join(', ')}`);

    // Подписываемся на каждый паттерн программно
    allPatterns.forEach((pattern) => {
      this.eventEmitter.on(pattern, this.handleApprovalDelta.bind(this));
    });
  }

  /**
   * Обработчик дельт одобрений
   * Обработка происходит через программную подписку в onModuleInit
   */
  async handleApprovalDelta(delta: IDelta): Promise<void> {
    await this.processDelta(delta);
  }
  /**
   * Получение поддерживаемых версий контрактов и таблиц
   */
  public getSupportedVersions(): { contracts: string[]; tables: string[] } {
    return {
      contracts: this.mapper.getSupportedContractNames(),
      tables: this.mapper.getSupportedTableNames(),
    };
  }

  /**
   * Получение всех паттернов событий для подписки
   */
  public getAllEventPatterns(): string[] {
    return this.mapper.getAllEventPatterns();
  }
}
