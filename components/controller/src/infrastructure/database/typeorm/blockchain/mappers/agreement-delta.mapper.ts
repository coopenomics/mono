import { Injectable } from '@nestjs/common';
import type { IDelta } from '~/types/common';
import { AgreementDomainEntity } from '~/domain/agreement/entities/agreement.entity';
import type { IAgreementBlockchainData } from '~/domain/agreement/interfaces/agreement-blockchain.interface';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { SovietContractInfoService } from '~/infrastructure/blockchain/services/soviet-contract-info.service';
import { AbstractBlockchainDeltaMapper } from '@coopenomics/extension-kit/sync';
import type { SovietContract } from 'cooptypes';
import { DomainToBlockchainUtils } from '@coopenomics/extension-kit';

/**
 * Маппер для преобразования дельт блокчейна в данные соглашения
 */
@Injectable()
export class AgreementDeltaMapper extends AbstractBlockchainDeltaMapper<IAgreementBlockchainData, AgreementDomainEntity> {
  constructor(private readonly logger: WinstonLoggerService, private readonly contractInfo: SovietContractInfoService) {
    super();
    this.logger.setContext(AgreementDeltaMapper.name);
  }

  /**
   * Маппинг дельты в данные соглашения из блокчейна
   */
  mapDeltaToBlockchainData(delta: IDelta): IAgreementBlockchainData | null {
    try {
      // Дельта содержит данные в поле value
      const value = delta.value as SovietContract.Tables.Agreements.IAgreement;
      if (!value) {
        this.logger.warn(`Delta has no value: table=${delta.table}, key=${delta.primary_key}`);
        return null;
      }

      // Парсим документ
      const document = DomainToBlockchainUtils.convertChainDocumentToDomainFormat(value.document);

      return { ...value, document };
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

    return delta.value[this.extractSyncKey()].toString();
  }

  /**
   * Извлечение ключа для синхронизации сущности в блокчейне и базе данных
   */
  extractSyncKey(): string {
    return AgreementDomainEntity.getSyncKey();
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
    return this.contractInfo.getTablePatterns('agreements3');
  }
}
