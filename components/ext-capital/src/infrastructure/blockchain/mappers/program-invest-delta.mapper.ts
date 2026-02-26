import { Injectable } from '@nestjs/common';
import type { IDelta } from '~/types/common';
import { ProgramInvestDomainEntity } from '../../../domain/entities/program-invest.entity';
import type { IProgramInvestBlockchainData } from '../../../domain/interfaces/program-invest-blockchain.interface';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { CapitalContractInfoService } from '../../services/capital-contract-info.service';
import { AbstractBlockchainDeltaMapper } from '~/shared/abstract-blockchain-delta.mapper';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';
import type { CapitalContract } from 'cooptypes';

/**
 * Маппер для преобразования дельт блокчейна в данные программной инвестиции
 */
@Injectable()
export class ProgramInvestDeltaMapper extends AbstractBlockchainDeltaMapper<
  IProgramInvestBlockchainData,
  ProgramInvestDomainEntity
> {
  constructor(private readonly logger: WinstonLoggerService, private readonly contractInfo: CapitalContractInfoService) {
    super();
    this.logger.setContext(ProgramInvestDeltaMapper.name);
  }

  mapDeltaToBlockchainData(delta: IDelta): IProgramInvestBlockchainData | null {
    try {
      // Дельта содержит данные в поле value
      const value = delta.value as CapitalContract.Tables.ProgramInvests.IProgramInvest;
      if (!value) {
        this.logger.warn(`Delta has no value: table=${delta.table}, key=${delta.primary_key}`);
        return null;
      }

      // 🔥 ВАЖНО: Парсим документы ПЕРЕД возвратом
      const statement = DomainToBlockchainUtils.convertChainDocumentToDomainFormat(value.statement);

      // Парсим документы
      return { ...value, statement };
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
    return ProgramInvestDomainEntity.getSyncKey();
  }

  getSupportedContractNames(): string[] {
    return this.contractInfo.getSupportedContractNames();
  }

  getSupportedTableNames(): string[] {
    return this.contractInfo.getTablePatterns('progrinvests');
  }
}
