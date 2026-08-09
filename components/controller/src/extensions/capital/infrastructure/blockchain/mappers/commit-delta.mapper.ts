import { Inject, Injectable } from '@nestjs/common';
import type { IDelta } from '~/types/common';
import { CommitDomainEntity } from '../../../domain/entities/commit.entity';
import type { ICommitBlockchainData } from '../../../domain/interfaces/commit-blockchain.interface';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { CapitalContractInfoService } from '../../services/capital-contract-info.service';
import { AbstractBlockchainDeltaMapper } from '@coopenomics/extension-kit/sync';

/**
 * Маппер для преобразования дельт блокчейна в данные коммита
 */
@Injectable()
export class CommitDeltaMapper extends AbstractBlockchainDeltaMapper<ICommitBlockchainData, CommitDomainEntity> {
  constructor(@Inject(LOGGER_PORT) private readonly logger: ILoggerPort, private readonly contractInfo: CapitalContractInfoService) {
    super();
    this.logger.setContext(CommitDeltaMapper.name);
  }

  /**
   * Маппинг дельты в данные коммита из блокчейна
   */
  mapDeltaToBlockchainData(delta: IDelta): ICommitBlockchainData | null {
    try {
      // Дельта содержит данные в поле value
      const value = delta.value;
      if (!value) {
        this.logger.warn(`Delta has no value: table=${delta.table}, key=${delta.primary_key}`);
        return null;
      }

      return value as ICommitBlockchainData;
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
    return CommitDomainEntity.getSyncKey();
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
    return this.contractInfo.getTablePatterns('commits');
  }
}
