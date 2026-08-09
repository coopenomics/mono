import { Inject, Injectable } from '@nestjs/common';
import type { IDelta } from '~/types/common';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { AbstractBlockchainDeltaMapper } from '@coopenomics/extension-kit/sync';
import { KuDecisionQuestionDomainEntity } from '../../../domain/entities/ku-decision-question.entity';
import type { IKuDecisionQuestionBlockchainData } from '../../../domain/interfaces/ku-blockchain-data.interface';
import { KuContractInfoService } from '../../services/ku-contract-info.service';

/**
 * Маппер дельт блокчейна для таблицы decisionq контракта branch
 */
@Injectable()
export class KuDecisionQuestionDeltaMapper extends AbstractBlockchainDeltaMapper<IKuDecisionQuestionBlockchainData, KuDecisionQuestionDomainEntity> {
  constructor(@Inject(LOGGER_PORT) private readonly logger: ILoggerPort, private readonly contractInfo: KuContractInfoService) {
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
