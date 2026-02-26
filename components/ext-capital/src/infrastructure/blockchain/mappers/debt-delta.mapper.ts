import { Injectable } from '@nestjs/common';
import type { IDelta } from '~/types/common';
import { DebtDomainEntity } from '../../../domain/entities/debt.entity';
import type { IDebtBlockchainData } from '../../../domain/interfaces/debt-blockchain.interface';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { CapitalContractInfoService } from '../../services/capital-contract-info.service';
import { AbstractBlockchainDeltaMapper } from '~/shared/abstract-blockchain-delta.mapper';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';
import type { CapitalContract } from 'cooptypes';

/**
 * Маппер для преобразования дельт блокчейна в данные долга
 */
@Injectable()
export class DebtDeltaMapper extends AbstractBlockchainDeltaMapper<IDebtBlockchainData, DebtDomainEntity> {
  constructor(private readonly logger: WinstonLoggerService, private readonly contractInfo: CapitalContractInfoService) {
    super();
    this.logger.setContext(DebtDeltaMapper.name);
  }

  /**
   * Маппинг дельты в данные долга из блокчейна
   */
  mapDeltaToBlockchainData(delta: IDelta): IDebtBlockchainData | null {
    try {
      // Дельта содержит данные в поле value
      const value = delta.value as CapitalContract.Tables.Debts.IDebt;
      if (!value) {
        this.logger.warn(`Delta has no value: table=${delta.table}, key=${delta.primary_key}`);
        return null;
      }

      const statement = DomainToBlockchainUtils.convertChainDocumentToDomainFormat(value.statement);
      const approved_statement = DomainToBlockchainUtils.convertChainDocumentToDomainFormat(value.approved_statement);
      const authorization = DomainToBlockchainUtils.convertChainDocumentToDomainFormat(value.authorization);

      // Парсим документы
      return { ...value, statement, approved_statement, authorization };
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
    return DebtDomainEntity.getSyncKey();
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
    return this.contractInfo.getTablePatterns('debts');
  }
}
