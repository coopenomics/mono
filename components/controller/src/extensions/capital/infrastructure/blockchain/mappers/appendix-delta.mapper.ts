import { Injectable } from '@nestjs/common';
import type { IDelta } from '~/types/common';
import { AppendixDomainEntity } from '../../../domain/entities/appendix.entity';
import type { IAppendixBlockchainData } from '../../../domain/interfaces/appendix-blockchain.interface';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { CapitalContractInfoService } from '../../services/capital-contract-info.service';
import { AbstractBlockchainDeltaMapper, type SignedDocField } from '~/shared/abstract-blockchain-delta.mapper';
import type { CapitalContract } from 'cooptypes';

/**
 * Маппер для преобразования дельт блокчейна в данные приложения.
 *
 * Story 6.2 (Epic 6): подписанные документы декларируются через
 * `signedDocumentFields` — `normalizeSignedDocuments(...)` базы нормализует все
 * описанные пути из `IChainDocument2` в `ISignedDocumentDomainInterface`.
 */
@Injectable()
export class AppendixDeltaMapper extends AbstractBlockchainDeltaMapper<IAppendixBlockchainData, AppendixDomainEntity> {
  protected readonly signedDocumentFields: ReadonlyArray<SignedDocField> = [{ path: 'appendix' }];

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

      // Story 6.2: ручная нормализация IChainDocument2 → ISignedDocumentDomain заменена
      // декларативным `signedDocumentFields` + `normalizeSignedDocuments`.
      // cast через unknown: до normalize value.appendix имеет тип IChainDocument2 (meta: string),
      // после normalize — ISignedDocumentDomainInterface (meta: object). TS этот rewrite не доказывает.
      return this.normalizeSignedDocuments({ ...value } as unknown as IAppendixBlockchainData);
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
