import { Inject, Injectable } from '@nestjs/common';
import type { IDelta } from '~/types/common';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { AbstractBlockchainDeltaMapper } from '@coopenomics/extension-kit/sync';
import { KuDecisionDomainEntity } from '../../../domain/entities/ku-decision.entity';
import type { IKuDecisionBlockchainData } from '../../../domain/interfaces/ku-blockchain-data.interface';
import { KuContractInfoService } from '../../services/ku-contract-info.service';

/**
 * Маппер дельт блокчейна для таблицы decisions контракта branch
 */
@Injectable()
export class KuDecisionDeltaMapper extends AbstractBlockchainDeltaMapper<IKuDecisionBlockchainData, KuDecisionDomainEntity> {
  constructor(@Inject(LOGGER_PORT) private readonly logger: ILoggerPort, private readonly contractInfo: KuContractInfoService) {
    super();
    this.logger.setContext(KuDecisionDeltaMapper.name);
  }

  mapDeltaToBlockchainData(delta: IDelta): IKuDecisionBlockchainData | null {
    const value = delta.value;
    if (!value) {
      this.logger.warn(`Delta has no value: table=${delta.table}, key=${delta.primary_key}`);
      return null;
    }

    return value as IKuDecisionBlockchainData;
  }

  extractSyncValue(delta: IDelta): string {
    const key = this.extractSyncKey();
    if (!delta.value || delta.value[key] === undefined || delta.value[key] === null) {
      throw new Error(`Delta has no value: table=${delta.table}, key=${key}`);
    }

    return String(delta.value[key]);
  }

  extractSyncKey(): string {
    return KuDecisionDomainEntity.getSyncKey();
  }

  getSupportedContractNames(): string[] {
    return this.contractInfo.getSupportedContractNames();
  }

  getSupportedTableNames(): string[] {
    return this.contractInfo.getTablePatterns('decisions');
  }
}
