import { CAPITAL_PROGRAM_WALLET_STORE } from '../database/capital-stores';
import { type TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { ProgramWalletDomainEntity } from '../../domain/entities/program-wallet.entity';
import { ProgramWalletRecord } from '../entities/program-wallet.record';
import { ProgramWalletMapper } from '../mappers/program-wallet.mapper';
import type { ProgramWalletRepository } from '../../domain/repositories/program-wallet.repository';
import { BaseChainRepository, ChainVersioningService } from '@coopenomics/extension-kit/sync';
import type { IProgramWalletDatabaseData } from '../../domain/interfaces/program-wallet-database.interface';
import type { IProgramWalletBlockchainData } from '../../domain/interfaces/program-wallet-blockchain.interface';

/**
 * Хранилище программных кошельков
 */
@Injectable()
export class ProgramWalletKyselyRepository
  extends BaseChainRepository<ProgramWalletDomainEntity, ProgramWalletRecord>
  implements ProgramWalletRepository
{
  constructor(
    @Inject(CAPITAL_PROGRAM_WALLET_STORE) repository: TableStore<ProgramWalletRecord>,
    @Inject(ChainVersioningService) versioning: ChainVersioningService
  ) {
    super(repository, versioning);
  }

  protected getMapper() {
    return {
      toDomain: ProgramWalletMapper.toDomain,
      toEntity: ProgramWalletMapper.toEntity,
    };
  }


  protected getSyncKey(): string {
    return ProgramWalletDomainEntity.getSyncKey();
  }

  protected createDomainEntity(
    databaseData: IProgramWalletDatabaseData,
    blockchainData: IProgramWalletBlockchainData
  ): ProgramWalletDomainEntity {
    return new ProgramWalletDomainEntity(databaseData, blockchainData);
  }
}
