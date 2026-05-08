import { Injectable } from '@nestjs/common';
import type { WalletContract } from 'cooptypes';
import type { IDelta } from '~/types/common';
import { UserAgreementDomainEntity } from '~/domain/wallet/entities/user-agreement-domain.entity';
import type { IUserAgreementBlockchainData } from '~/domain/wallet/interfaces/user-agreement-blockchain.interface';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { WalletContractInfoService } from '~/infrastructure/blockchain/services/wallet-contract-info.service';
import { AbstractBlockchainDeltaMapper } from '~/shared/abstract-blockchain-delta.mapper';

/**
 * Маппер дельт `wallet::users` → blockchain-данные owner'а программных соглашений.
 *
 * `coopname` берётся из `delta.scope`: scope-таблица не содержит coopname
 * в самом value, в отличие от `soviet::agreements3`.
 */
@Injectable()
export class UserAgreementDeltaMapper extends AbstractBlockchainDeltaMapper<
  IUserAgreementBlockchainData,
  UserAgreementDomainEntity
> {
  constructor(private readonly logger: WinstonLoggerService, private readonly contractInfo: WalletContractInfoService) {
    super();
    this.logger.setContext(UserAgreementDeltaMapper.name);
  }

  mapDeltaToBlockchainData(delta: IDelta): IUserAgreementBlockchainData | null {
    try {
      const value = delta.value as WalletContract.Tables.Users.IUser | undefined;
      if (!value) {
        this.logger.warn(`Delta has no value: table=${delta.table}, key=${delta.primary_key}`);
        return null;
      }

      return {
        coopname: String(delta.scope),
        username: String(value.username),
        programs: Array.isArray(value.programs) ? value.programs : [],
      };
    } catch (error: any) {
      this.logger.error(`Error mapping delta to blockchain data: ${error.message}`, error.stack);
      return null;
    }
  }

  extractSyncValue(delta: IDelta): string {
    if (!delta.value || !(delta.value as any)[this.extractSyncKey()]) {
      throw new Error(`Delta has no value: table=${delta.table}, key=${this.extractSyncKey()}`);
    }
    return String((delta.value as any)[this.extractSyncKey()]);
  }

  extractSyncKey(): string {
    return UserAgreementDomainEntity.getSyncKey();
  }

  getSupportedContractNames(): string[] {
    return this.contractInfo.getSupportedContractNames();
  }

  getSupportedTableNames(): string[] {
    return this.contractInfo.getTablePatterns('users');
  }
}
