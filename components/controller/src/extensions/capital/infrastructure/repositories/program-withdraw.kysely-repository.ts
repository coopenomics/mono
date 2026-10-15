import { CAPITAL_PROGRAM_WITHDRAW_STORE } from '../database/capital-stores';
import { type TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { ProgramWithdrawDomainEntity } from '../../domain/entities/program-withdraw.entity';
import { ProgramWithdrawRecord } from '../entities/program-withdraw.record';
import { ProgramWithdrawMapper } from '../mappers/program-withdraw.mapper';
import type { ProgramWithdrawRepository } from '../../domain/repositories/program-withdraw.repository';
import { BaseChainRepository, ChainVersioningService } from '@coopenomics/extension-kit/sync';
import type { IProgramWithdrawDatabaseData } from '../../domain/interfaces/program-withdraw-database.interface';
import type { IProgramWithdrawBlockchainData } from '../../domain/interfaces/program-withdraw-blockchain.interface';

/**
 * Хранилище возвратов из программы
 */
@Injectable()
export class ProgramWithdrawKyselyRepository
  extends BaseChainRepository<ProgramWithdrawDomainEntity, ProgramWithdrawRecord>
  implements ProgramWithdrawRepository
{
  constructor(
    @Inject(CAPITAL_PROGRAM_WITHDRAW_STORE) repository: TableStore<ProgramWithdrawRecord>,
    @Inject(ChainVersioningService) versioning: ChainVersioningService
  ) {
    super(repository, versioning);
  }

  protected getMapper() {
    return {
      toDomain: ProgramWithdrawMapper.toDomain,
      toEntity: ProgramWithdrawMapper.toEntity,
    };
  }


  protected createDomainEntity(
    databaseData: IProgramWithdrawDatabaseData,
    blockchainData: IProgramWithdrawBlockchainData
  ): ProgramWithdrawDomainEntity {
    return new ProgramWithdrawDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return ProgramWithdrawDomainEntity.getSyncKey();
  }
}
