import { Inject, Injectable } from '@nestjs/common';
import type { IDelta } from '~/types/common';
import { ProgramWithdrawDomainEntity } from '../../../domain/entities/program-withdraw.entity';
import type { IProgramWithdrawBlockchainData } from '../../../domain/interfaces/program-withdraw-blockchain.interface';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { CapitalContractInfoService } from '../../services/capital-contract-info.service';
import { AbstractBlockchainDeltaMapper } from '@coopenomics/extension-kit/sync';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';
import type { CapitalContract } from 'cooptypes';

/**
 * Маппер для преобразования дельт блокчейна в данные возврата из программы
 */
@Injectable()
export class ProgramWithdrawDeltaMapper extends AbstractBlockchainDeltaMapper<
  IProgramWithdrawBlockchainData,
  ProgramWithdrawDomainEntity
> {
  constructor(@Inject(LOGGER_PORT) private readonly logger: ILoggerPort, private readonly contractInfo: CapitalContractInfoService) {
    super();
    this.logger.setContext(ProgramWithdrawDeltaMapper.name);
  }

  mapDeltaToBlockchainData(delta: IDelta): IProgramWithdrawBlockchainData | null {
    try {
      // Дельта содержит данные в поле value
      const value = delta.value as CapitalContract.Tables.ProgramWithdraws.IProgramWithdraw;
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
    return ProgramWithdrawDomainEntity.getSyncKey();
  }

  getSupportedContractNames(): string[] {
    return this.contractInfo.getSupportedContractNames();
  }

  getSupportedTableNames(): string[] {
    return this.contractInfo.getTablePatterns('prgwithdraws');
  }
}
