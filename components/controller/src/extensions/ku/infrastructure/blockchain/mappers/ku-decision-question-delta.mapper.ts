import { Injectable } from '@nestjs/common';
import type { IDelta } from '~/types/common';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { AbstractBlockchainDeltaMapper } from '~/shared/abstract-blockchain-delta.mapper';
import { KuDecisionQuestionDomainEntity } from '../../../domain/entities/ku-decision-question.entity';
import type { IKuDecisionQuestionBlockchainData } from '../../../domain/interfaces/ku-blockchain-data.interface';
import { KuContractInfoService } from '../../services/ku-contract-info.service';

/**
 * Маппер дельт блокчейна для таблицы decisionq контракта branch
 */
@Injectable()
export class KuDecisionQuestionDeltaMapper extends AbstractBlockchainDeltaMapper<IKuDecisionQuestionBlockchainData, KuDecisionQuestionDomainEntity> {
  constructor(private readonly logger: WinstonLoggerService, private readonly contractInfo: KuContractInfoService) {
    super();
    this.logger.setContext(KuDecisionQuestionDeltaMapper.name);
  }

  mapDeltaToBlockchainData(delta: IDelta): IKuDecisionQuestionBlockchainData | null {
    const value = delta.value;
    if (!value) {
      this.logger.warn(`Delta has no value: table=${delta.table}, key=${delta.primary_key}`);
      return null;
    }

    return value as IKuDecisionQuestionBlockchainData;
  }

  extractSyncValue(delta: IDelta): string {
    const key = this.extractSyncKey();
    if (!delta.value || delta.value[key] === undefined || delta.value[key] === null) {
      throw new Error(`Delta has no value: table=${delta.table}, key=${key}`);
    }

    return String(delta.value[key]);
  }

  extractSyncKey(): string {
    return KuDecisionQuestionDomainEntity.getSyncKey();
  }

  getSupportedContractNames(): string[] {
    return this.contractInfo.getSupportedContractNames();
  }

  getSupportedTableNames(): string[] {
    return this.contractInfo.getTablePatterns('decisionq');
  }
}
