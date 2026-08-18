import { Inject, Injectable } from '@nestjs/common';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { AbstractBlockchainDeltaMapper, type IDelta } from '@coopenomics/extension-kit/sync';
import { KuTrustRequestDomainEntity } from '../../../domain/entities/ku-trust-request.entity';
import type { IKuTrustRequestBlockchainData } from '../../../domain/interfaces/ku-blockchain-data.interface';
import { KuContractInfoService } from '../../services/ku-contract-info.service';

/**
 * Маппер дельт блокчейна для таблицы trustreqs контракта branch
 */
@Injectable()
export class KuTrustRequestDeltaMapper extends AbstractBlockchainDeltaMapper<IKuTrustRequestBlockchainData, KuTrustRequestDomainEntity> {
  constructor(@Inject(LOGGER_PORT) private readonly logger: ILoggerPort, private readonly contractInfo: KuContractInfoService) {
    super();
    this.logger.setContext(KuTrustRequestDeltaMapper.name);
  }

  mapDeltaToBlockchainData(delta: IDelta): IKuTrustRequestBlockchainData | null {
    const value = delta.value;
    if (!value) {
      this.logger.warn(`Delta has no value: table=${delta.table}, key=${delta.primary_key}`);
      return null;
    }

    return value as IKuTrustRequestBlockchainData;
  }

  extractSyncValue(delta: IDelta): string {
    const key = this.extractSyncKey();
    if (!delta.value || delta.value[key] === undefined || delta.value[key] === null) {
      throw new Error(`Delta has no value: table=${delta.table}, key=${key}`);
    }

    return String(delta.value[key]);
  }

  extractSyncKey(): string {
    return KuTrustRequestDomainEntity.getSyncKey();
  }

  getSupportedContractNames(): string[] {
    return this.contractInfo.getSupportedContractNames();
  }

  getSupportedTableNames(): string[] {
    return this.contractInfo.getTablePatterns('trustreqs');
  }
}
