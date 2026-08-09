import { Inject, Injectable } from '@nestjs/common';
import type { IDelta } from '~/types/common';
import { SegmentDomainEntity } from '../../../domain/entities/segment.entity';
import type { ISegmentBlockchainData } from '../../../domain/interfaces/segment-blockchain.interface';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { CapitalContractInfoService } from '../../services/capital-contract-info.service';
import { AbstractBlockchainDeltaMapper } from '@coopenomics/extension-kit/sync';
import type { CapitalContract } from 'cooptypes';

/**
 * Маппер для преобразования дельт блокчейна в данные сегмента
 */
@Injectable()
export class SegmentDeltaMapper extends AbstractBlockchainDeltaMapper<ISegmentBlockchainData, SegmentDomainEntity> {
  constructor(@Inject(LOGGER_PORT) private readonly logger: ILoggerPort, private readonly contractInfo: CapitalContractInfoService) {
    super();
    this.logger.setContext(SegmentDeltaMapper.name);
  }

  /**
   * Маппинг дельты в данные сегмента из блокчейна
   */
  mapDeltaToBlockchainData(delta: IDelta): ISegmentBlockchainData | null {
    try {
      // Дельта содержит данные в поле value
      const value = delta.value as CapitalContract.Tables.Segments.ISegment;
      if (!value) {
        this.logger.warn(`Delta has no value: table=${delta.table}, key=${delta.primary_key}`);
        return null;
      }

      // Для сегментов не требуется парсинг документов, так как их нет в этой таблице
      // Возвращаем данные напрямую
      return value;
    } catch (error: any) {
      this.logger.error(`Error mapping delta to blockchain data: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Извлечение ID сущности из дельты
   */
  extractSyncValue(delta: IDelta): string {
    if (!delta.value || !delta.value[SegmentDomainEntity.getSyncKey()]) {
      throw new Error(`Delta has no value: table=${delta.table}, key=${SegmentDomainEntity.getSyncKey()}`);
    }

    return delta.value[SegmentDomainEntity.getSyncKey()];
  }

  /**
   * Извлечение ключа для синхронизации сущности в блокчейне и базе данных
   */
  extractSyncKey(): string {
    return SegmentDomainEntity.getSyncKey();
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
    return this.contractInfo.getTablePatterns('segments');
  }
}
