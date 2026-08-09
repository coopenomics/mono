import { Inject, Injectable } from '@nestjs/common';
import type { IDelta } from '~/types/common';
import { ProgramPropertyDomainEntity } from '../../../domain/entities/program-property.entity';
import type { IProgramPropertyBlockchainData } from '../../../domain/interfaces/program-property-blockchain.interface';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { CapitalContractInfoService } from '../../services/capital-contract-info.service';
import { AbstractBlockchainDeltaMapper } from '@coopenomics/extension-kit/sync';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';
import type { CapitalContract } from 'cooptypes';

/**
 * Маппер для преобразования дельт блокчейна в данные программного имущественного взноса
 */
@Injectable()
export class ProgramPropertyDeltaMapper extends AbstractBlockchainDeltaMapper<
  IProgramPropertyBlockchainData,
  ProgramPropertyDomainEntity
> {
  constructor(@Inject(LOGGER_PORT) private readonly logger: ILoggerPort, private readonly contractInfo: CapitalContractInfoService) {
    super();
    this.logger.setContext(ProgramPropertyDeltaMapper.name);
  }

  mapDeltaToBlockchainData(delta: IDelta): IProgramPropertyBlockchainData | null {
    try {
      // Дельта содержит данные в поле value
      const value = delta.value as CapitalContract.Tables.ProgramProperties.IProgramProperty;
      if (!value) {
        this.logger.warn(`Delta has no value: table=${delta.table}, key=${delta.primary_key}`);
        return null;
      }

      // 🔥 ВАЖНО: Парсим документы ПЕРЕД возвратом
      const statement = DomainToBlockchainUtils.convertChainDocumentToDomainFormat(value.statement);
      const authorization = DomainToBlockchainUtils.convertChainDocumentToDomainFormat(value.authorization);
      const act = DomainToBlockchainUtils.convertChainDocumentToDomainFormat(value.act);

      // Парсим документы
      return { ...value, statement, authorization, act };
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
    return ProgramPropertyDomainEntity.getSyncKey();
  }

  getSupportedContractNames(): string[] {
    return this.contractInfo.getSupportedContractNames();
  }

  getSupportedTableNames(): string[] {
    return this.contractInfo.getTablePatterns('pgproperties');
  }
}
