import { Injectable } from '@nestjs/common';
import type { Ledger2Contract } from 'cooptypes';
import type { IDelta } from '~/types/common';
import { UserWalletDomainEntity } from '~/domain/wallet/entities/user-wallet-domain.entity';
import type { IUserWalletBlockchainData } from '~/domain/wallet/interfaces/user-wallet-blockchain.interface';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { Ledger2ContractInfoService } from '~/infrastructure/blockchain/services/ledger2-contract-info.service';
import { AbstractBlockchainDeltaMapper } from '~/shared/abstract-blockchain-delta.mapper';

/**
 * Маппер дельт `ledger2::userwallets` → blockchain-данные L3 кошелька.
 *
 * `coopname` берётся из `delta.scope` (scope-таблица).
 */
@Injectable()
export class UserWalletDeltaMapper extends AbstractBlockchainDeltaMapper<
  IUserWalletBlockchainData,
  UserWalletDomainEntity
> {
  constructor(private readonly logger: WinstonLoggerService, private readonly contractInfo: Ledger2ContractInfoService) {
    super();
    this.logger.setContext(UserWalletDeltaMapper.name);
  }

  mapDeltaToBlockchainData(delta: IDelta): IUserWalletBlockchainData | null {
    try {
      const value = delta.value as Ledger2Contract.Tables.UserWallets.IUserWallet | undefined;
      if (!value) {
        this.logger.warn(`Delta has no value: table=${delta.table}, key=${delta.primary_key}`);
        return null;
      }

      return {
        id: String(value.id),
        coopname: String(delta.scope),
        wallet_name: String(value.wallet_name),
        username: String(value.username),
        available: String(value.available),
        blocked: String(value.blocked),
      };
    } catch (error: any) {
      this.logger.error(`Error mapping delta to blockchain data: ${error.message}`, error.stack);
      return null;
    }
  }

  extractSyncValue(delta: IDelta): string {
    if (!delta.value || (delta.value as any)[this.extractSyncKey()] === undefined) {
      throw new Error(`Delta has no value: table=${delta.table}, key=${this.extractSyncKey()}`);
    }
    return String((delta.value as any)[this.extractSyncKey()]);
  }

  extractSyncKey(): string {
    return UserWalletDomainEntity.getSyncKey();
  }

  getSupportedContractNames(): string[] {
    return this.contractInfo.getSupportedContractNames();
  }

  getSupportedTableNames(): string[] {
    return this.contractInfo.getTablePatterns('userwallets');
  }
}
