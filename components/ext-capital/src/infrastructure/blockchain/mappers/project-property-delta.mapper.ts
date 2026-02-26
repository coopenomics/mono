import { Injectable } from '@nestjs/common';
import type { IDelta } from '~/types/common';
import { ProjectPropertyDomainEntity } from '../../../domain/entities/project-property.entity';
import type { IProjectPropertyBlockchainData } from '../../../domain/interfaces/project-property-blockchain.interface';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { CapitalContractInfoService } from '../../services/capital-contract-info.service';
import { AbstractBlockchainDeltaMapper } from '~/shared/abstract-blockchain-delta.mapper';
import type { CapitalContract } from 'cooptypes';

/**
 * Маппер для преобразования дельт блокчейна в данные проектного имущественного взноса
 */
@Injectable()
export class ProjectPropertyDeltaMapper extends AbstractBlockchainDeltaMapper<
  IProjectPropertyBlockchainData,
  ProjectPropertyDomainEntity
> {
  constructor(private readonly logger: WinstonLoggerService, private readonly contractInfo: CapitalContractInfoService) {
    super();
    this.logger.setContext(ProjectPropertyDeltaMapper.name);
  }

  mapDeltaToBlockchainData(delta: IDelta): IProjectPropertyBlockchainData | null {
    try {
      // Дельта содержит данные в поле value
      const value = delta.value as CapitalContract.Tables.ProjectProperties.IProperty;
      if (!value) {
        this.logger.warn(`Delta has no value: table=${delta.table}, key=${delta.primary_key}`);
        return null;
      }

      // Для ProjectProperties нет документов для парсинга
      return value;
    } catch (error: any) {
      this.logger.error(`Error mapping delta to blockchain data: ${error.message}`, error.stack);
      return null;
    }
  }

  extractSyncValue(delta: IDelta): string {
    if (!delta.value || !delta.value[this.extractSyncKey()]) {
      throw new Error(`Delta has no value: table=${delta.table}, key=${this.extractSyncKey()}`);
    }

    return delta.value[this.extractSyncKey()];
  }

  extractSyncKey(): string {
    return ProjectPropertyDomainEntity.getSyncKey();
  }

  getSupportedContractNames(): string[] {
    return this.contractInfo.getSupportedContractNames();
  }

  getSupportedTableNames(): string[] {
    return this.contractInfo.getTablePatterns('pjproperties');
  }
}
