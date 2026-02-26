import { Injectable } from '@nestjs/common';
import type { IDelta } from '~/types/common';
import { ContributorDomainEntity } from '../../../domain/entities/contributor.entity';
import type { IContributorBlockchainData } from '../../../domain/interfaces/contributor-blockchain.interface';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { CapitalContractInfoService } from '../../services/capital-contract-info.service';
import { AbstractBlockchainDeltaMapper } from '~/shared/abstract-blockchain-delta.mapper';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';
import type { CapitalContract } from 'cooptypes';

/**
 * Маппер для преобразования дельт блокчейна в данные участника
 */
@Injectable()
export class ContributorDeltaMapper extends AbstractBlockchainDeltaMapper<
  IContributorBlockchainData,
  ContributorDomainEntity
> {
  constructor(private readonly logger: WinstonLoggerService, private readonly contractInfo: CapitalContractInfoService) {
    super();
    this.logger.setContext(ContributorDeltaMapper.name);
  }

  /**
   * Маппинг дельты в данные участника из блокчейна
   */
  mapDeltaToBlockchainData(delta: IDelta | { value: any }): IContributorBlockchainData | null {
    try {
      // Дельта содержит данные в поле value
      const value = delta.value as CapitalContract.Tables.Contributors.IContributor;
      if (!value) {
        return null;
      }

      // Парсим документ
      const contract = DomainToBlockchainUtils.convertChainDocumentToDomainFormat(value.contract);

      return { ...value, contract };
    } catch (error: any) {
      this.logger.error(`Error mapping delta to blockchain data: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Извлечение ID сущности из дельты
   */
  extractSyncValue(delta: IDelta): string {
    if (!delta.value || !delta.value[this.extractSyncKey()]) {
      throw new Error(`Delta has no value: table=${delta.table}, key=${this.extractSyncKey()}`);
    }

    return delta.value[this.extractSyncKey()];
  }

  /**
   * Извлечение ключа для синхронизации сущности в блокчейне и базе данных
   */
  extractSyncKey(): string {
    return ContributorDomainEntity.getSyncKey();
  }

  /**
   * Получение всех поддерживаемых имен контрактов
   */
  getSupportedContractNames(): string[] {
    return this.contractInfo.getSupportedContractNames();
  }

  /**
   * Получение всех поддерживаемых имен таблиц
   */
  getSupportedTableNames(): string[] {
    return this.contractInfo.getTablePatterns('contributors');
  }
}
