import { Inject, Injectable } from '@nestjs/common';
import { DebtDomainEntity } from '../../../domain/entities/debt.entity';
import type { IDebtBlockchainData } from '../../../domain/interfaces/debt-blockchain.interface';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { CapitalContractInfoService } from '../../services/capital-contract-info.service';
import { AbstractBlockchainDeltaMapper, type IDelta } from '@coopenomics/extension-kit/sync';
import type { CapitalContract } from 'cooptypes';
import { DomainToBlockchainUtils } from '@coopenomics/extension-kit';

/**
 * Маппер для преобразования дельт блокчейна в данные долга
 */
@Injectable()
export class DebtDeltaMapper extends AbstractBlockchainDeltaMapper<IDebtBlockchainData, DebtDomainEntity> {
  constructor(@Inject(LOGGER_PORT) private readonly logger: ILoggerPort, private readonly contractInfo: CapitalContractInfoService) {
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
