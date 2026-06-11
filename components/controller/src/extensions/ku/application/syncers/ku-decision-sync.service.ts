import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { AbstractEntitySyncService } from '~/shared/services/abstract-entity-sync.service';
import { KuDecisionDomainEntity } from '../../domain/entities/ku-decision.entity';
import { KuDecisionRepository, KU_DECISION_REPOSITORY } from '../../domain/repositories/ku-decision.repository';
import { KuDecisionDeltaMapper } from '../../infrastructure/blockchain/mappers/ku-decision-delta.mapper';
import type { IKuDecisionBlockchainData } from '../../domain/interfaces/ku-blockchain-data.interface';

/**
 * Сервис синхронизации решений собраний участков с блокчейном (контракт branch).
 * История сохраняется в PG после erase записи в блокчейне (present=false).
 */
@Injectable()
export class KuDecisionSyncService extends AbstractEntitySyncService<KuDecisionDomainEntity, IKuDecisionBlockchainData> implements OnModuleInit {
  protected readonly entityName = 'KuDecisionDomainEntity';

  constructor(
    @Inject(KU_DECISION_REPOSITORY)
    repository: KuDecisionRepository,
    mapper: KuDecisionDeltaMapper,
    logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2
  ) {
    super(repository, mapper, logger);
  }

  async onModuleInit() {
    const allPatterns = this.getAllEventPatterns();
    this.logger.debug(`Подписка на ${allPatterns.length} паттернов событий: ${allPatterns.join(', ')}`);

    allPatterns.forEach((pattern) => {
      this.eventEmitter.on(pattern, this.processDelta.bind(this));
    });
  }

  @OnEvent('fork::*')
  async handleEntityFork(forkData: { block_num: number }): Promise<void> {
    await this.handleFork(forkData.block_num);
  }
}
