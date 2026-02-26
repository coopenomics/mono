import { Injectable } from '@nestjs/common';
import type { IDelta } from '~/types/common';
import { AppendixDomainEntity } from '../../../domain/entities/appendix.entity';
import type { IAppendixBlockchainData } from '../../../domain/interfaces/appendix-blockchain.interface';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { CapitalContractInfoService } from '../../services/capital-contract-info.service';
import { AbstractBlockchainDeltaMapper } from '~/shared/abstract-blockchain-delta.mapper';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';
import type { CapitalContract } from 'cooptypes';

/**
 * Маппер для преобразования дельт блокчейна в данные приложения
 */
@Injectable()
export class AppendixDeltaMapper extends AbstractBlockchainDeltaMapper<IAppendixBlockchainData, AppendixDomainEntity> {
  constructor(private readonly logger: WinstonLoggerService, private readonly contractInfo: CapitalContractInfoService) {
    super();
    this.logger.setContext(AppendixDeltaMapper.name);
  }

  mapDeltaToBlockchainData(delta: IDelta | { value: any }): IAppendixBlockchainData | null {
    try {
      // Дельта содержит данные в поле value
      const value = delta.value as CapitalContract.Tables.Appendixes.IAppendix;
      if (!value) {
        const table = 'table' in delta ? delta.table : 'unknown';
        const key = 'primary_key' in delta ? delta.primary_key : 'unknown';
        this.logger.warn(`Delta has no value: table=${table}, key=${key}`);
        return null;
      }

      // 🔥 ВАЖНО: Парсим документы ПЕРЕД возвратом
      const appendix = DomainToBlockchainUtils.convertChainDocumentToDomainFormat(value.appendix);

      // Парсим документы
      return { ...value, appendix };
    } catch (error: any) {
      this.logger.error(`Error mapping delta to blockchain data: ${error.message}`, error.stack);
      return null;
    }
  }

  extractSyncValue(delta: IDelta | { value: any }): string {
    if (!delta.value || !delta.value[this.extractSyncKey()]) {
      const table = 'table' in delta ? delta.table : 'unknown';
      const key = this.extractSyncKey();
      throw new Error(`Delta has no value: table=${table}, key=${key}`);
    }

    return delta.value[this.extractSyncKey()];
  }

  extractSyncKey(): string {
    return AppendixDomainEntity.getSyncKey();
  }

  getSupportedContractNames(): string[] {
    return this.contractInfo.getSupportedContractNames();
  }

  getSupportedTableNames(): string[] {
    return this.contractInfo.getTablePatterns('appendixes');
  }
}
