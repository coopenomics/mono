import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ProgramWalletDomainEntity } from '../../domain/entities/program-wallet.entity';
import { ProgramWalletTypeormEntity } from '../entities/program-wallet.typeorm-entity';
import { ProgramWalletMapper } from '../mappers/program-wallet.mapper';
import type { ProgramWalletRepository } from '../../domain/repositories/program-wallet.repository';
import { CAPITAL_DATABASE_CONNECTION } from '../database/capital-database.module';
import { BaseBlockchainRepository } from '~/shared/sync/repositories/base-blockchain.repository';
import { EntityVersioningService } from '~/shared/sync/services/entity-versioning.service';
import type { IProgramWalletDatabaseData } from '../../domain/interfaces/program-wallet-database.interface';
import type { IProgramWalletBlockchainData } from '../../domain/interfaces/program-wallet-blockchain.interface';

/**
 * TypeORM реализация репозитория программных кошельков
 */
@Injectable()
export class ProgramWalletTypeormRepository
  extends BaseBlockchainRepository<ProgramWalletDomainEntity, ProgramWalletTypeormEntity>
  implements ProgramWalletRepository
{
  constructor(
    @InjectRepository(ProgramWalletTypeormEntity, CAPITAL_DATABASE_CONNECTION)
    repository: Repository<ProgramWalletTypeormEntity>,
    entityVersioningService: EntityVersioningService
  ) {
    super(repository, entityVersioningService);
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
