import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { AbstractEntitySyncService } from '@coopenomics/extension-kit/sync';
import { KuDecisionQuestionDomainEntity } from '../../domain/entities/ku-decision-question.entity';
import { KuDecisionQuestionRepository, KU_DECISION_QUESTION_REPOSITORY } from '../../domain/repositories/ku-decision-question.repository';
import { KuDecisionQuestionDeltaMapper } from '../../infrastructure/blockchain/mappers/ku-decision-question-delta.mapper';
import type { IKuDecisionQuestionBlockchainData } from '../../domain/interfaces/ku-blockchain-data.interface';

/**
 * Сервис синхронизации вопросов повесток собраний участков с блокчейном (контракт branch).
 * История сохраняется в PG после erase записи в блокчейне (present=false).
 */
@Injectable()
export class KuDecisionQuestionSyncService extends AbstractEntitySyncService<KuDecisionQuestionDomainEntity, IKuDecisionQuestionBlockchainData> implements OnModuleInit {
  protected readonly entityName = 'KuDecisionQuestionDomainEntity';

  constructor(
    @Inject(KU_DECISION_QUESTION_REPOSITORY)
    repository: KuDecisionQuestionRepository,
    mapper: KuDecisionQuestionDeltaMapper,
    @Inject(LOGGER_PORT) logger: ILoggerPort,
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
