import { Injectable } from '@nestjs/common';
import type { IDelta } from '~/types/common';
import { StateDomainEntity } from '../../../domain/entities/state.entity';
import type { IStateBlockchainData } from '../../../domain/interfaces/state-blockchain.interface';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { CapitalContractInfoService } from '../../services/capital-contract-info.service';
import { AbstractBlockchainDeltaMapper } from '~/shared/abstract-blockchain-delta.mapper';

/**
 * Маппер для преобразования дельт блокчейна в данные состояния
 */
@Injectable()
export class StateDeltaMapper extends AbstractBlockchainDeltaMapper<IStateBlockchainData, StateDomainEntity> {
  constructor(private readonly logger: WinstonLoggerService, private readonly contractInfo: CapitalContractInfoService) {
    super();
    this.logger.setContext(StateDeltaMapper.name);
  }

  /**
   * Маппинг дельты в данные состояния из блокчейна
   */
  mapDeltaToBlockchainData(delta: IDelta): IStateBlockchainData | null {
    try {
      // Дельта содержит данные в поле value
      const value = delta.value;
      if (!value) {
        this.logger.warn(`Delta has no value: table=${delta.table}, key=${delta.primary_key}`);
        return null;
      }

      return value as IStateBlockchainData;
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
    return StateDomainEntity.getSyncKey();
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
    return this.contractInfo.getTablePatterns('state');
  }
}
