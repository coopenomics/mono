import { Injectable } from '@nestjs/common';
import type { IDelta } from '~/types/common';
import { ProgramWalletDomainEntity } from '~/domain/wallet/entities/program-wallet-domain.entity';
import type { IProgramWalletBlockchainData } from '~/domain/wallet/interfaces/program-wallet-blockchain.interface';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { SovietContractInfoService } from '~/infrastructure/blockchain/services/soviet-contract-info.service';
import { AbstractBlockchainDeltaMapper } from '@coopenomics/extension-kit/sync';
import type { SovietContract } from 'cooptypes';

/**
 * Маппер для преобразования дельт блокчейна в данные программного кошелька
 * Обрабатывает дельты таблицы progwallets контракта soviet
 */
@Injectable()
export class ProgramWalletDeltaMapper extends AbstractBlockchainDeltaMapper<
  IProgramWalletBlockchainData,
  ProgramWalletDomainEntity
> {
  constructor(private readonly logger: WinstonLoggerService, private readonly contractInfo: SovietContractInfoService) {
    super();
    this.logger.setContext(ProgramWalletDeltaMapper.name);
  }

  /**
   * Маппинг дельты в данные программного кошелька из блокчейна
   */
  mapDeltaToBlockchainData(delta: IDelta): IProgramWalletBlockchainData | null {
    try {
      // Дельта содержит данные в поле value
      const value = delta.value as SovietContract.Tables.ProgramWallets.IProgramWallet;
      if (!value) {
        this.logger.warn(`Delta has no value: table=${delta.table}, key=${delta.primary_key}`);
        return null;
      }

      return {
        id: value.id.toString(),
        coopname: value.coopname,
        program_id: value.program_id.toString(),
        agreement_id: value.agreement_id.toString(),
        username: value.username,
        available: value.available,
        blocked: value.blocked,
        membership_contribution: value.membership_contribution,
      };
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
    return ProgramWalletDomainEntity.getSyncKey();
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
    return this.contractInfo.getTablePatterns('progwallets');
  }
}
