import { Injectable } from '@nestjs/common';
import type { IDelta } from '~/types/common';
import { ProgramWalletDomainEntity } from '../../../domain/entities/program-wallet.entity';
import type { IProgramWalletBlockchainData } from '../../../domain/interfaces/program-wallet-blockchain.interface';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { CapitalContractInfoService } from '../../services/capital-contract-info.service';
import { AbstractBlockchainDeltaMapper } from '~/shared/abstract-blockchain-delta.mapper';
import type { CapitalContract } from 'cooptypes';

/**
 * Маппер для преобразования дельт блокчейна в данные программного кошелька
 */
@Injectable()
export class ProgramWalletDeltaMapper extends AbstractBlockchainDeltaMapper<
  IProgramWalletBlockchainData,
  ProgramWalletDomainEntity
> {
  constructor(private readonly logger: WinstonLoggerService, private readonly contractInfo: CapitalContractInfoService) {
    super();
    this.logger.setContext(ProgramWalletDeltaMapper.name);
  }

  mapDeltaToBlockchainData(delta: IDelta): IProgramWalletBlockchainData | null {
    try {
      // Дельта содержит данные в поле value
      const value = delta.value as CapitalContract.Tables.ProgramWallets.ICapitalWallet;
      if (!value) {
        this.logger.warn(`Delta has no value: table=${delta.table}, key=${delta.primary_key}`);
        return null;
      }

      // Для ProgramWallets нет документов для парсинга
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
    return ProgramWalletDomainEntity.getSyncKey();
  }

  getSupportedContractNames(): string[] {
    return this.contractInfo.getSupportedContractNames();
  }

  getSupportedTableNames(): string[] {
    return this.contractInfo.getTablePatterns('capwallets');
  }
}
