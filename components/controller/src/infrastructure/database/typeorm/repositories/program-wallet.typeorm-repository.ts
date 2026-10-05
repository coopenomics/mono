import { CORE_PROGRAM_WALLET_STORE } from '../../kysely/core-stores';
import { type TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { ProgramWalletDomainEntity } from '~/domain/wallet/entities/program-wallet-domain.entity';
import { ProgramWalletTypeormEntity } from '../entities/program-wallet.typeorm-entity';
import { ProgramWalletMapper } from '../mappers/program-wallet.mapper';
import type { ProgramWalletRepository } from '~/domain/wallet/repositories/program-wallet.repository';
import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { BaseChainRepository, ChainVersioningService } from '@coopenomics/extension-kit/sync';
import type { IProgramWalletBlockchainData } from '~/domain/wallet/interfaces/program-wallet-blockchain.interface';
import type { IProgramWalletDatabaseData } from '~/domain/wallet/interfaces/program-wallet-database.interface';

/**
 * TypeORM реализация репозитория программных кошельков
 * Обеспечивает синхронизацию данных кошельков между блокчейном и базой данных
 */
@Injectable()
export class ProgramWalletTypeormRepository
  extends BaseChainRepository<ProgramWalletDomainEntity, ProgramWalletTypeormEntity>
  implements ProgramWalletRepository, IBlockchainSyncRepository<ProgramWalletDomainEntity>
{
  constructor(
    @Inject(CORE_PROGRAM_WALLET_STORE) repository: TableStore<ProgramWalletTypeormEntity>,
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

  protected createDomainEntity(
    databaseData: IProgramWalletDatabaseData,
    blockchainData: IProgramWalletBlockchainData
  ): ProgramWalletDomainEntity {
    return new ProgramWalletDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return ProgramWalletDomainEntity.getSyncKey();
  }

  /**
   * Найти кошелек по имени пользователя и ID программы
   */
  async findByUsernameAndProgramId(username: string, program_id: string): Promise<ProgramWalletDomainEntity | null> {
    const entity = await this.repository.findOne({ username, program_id });

    return entity ? ProgramWalletMapper.toDomain(entity) : null;
  }

  /**
   * Найти все кошельки пользователя
   */
  async findByUsername(username: string): Promise<ProgramWalletDomainEntity[]> {
    const entities = await this.repository.find({ username }, { order: { program_id: 'ASC' } });

    return entities.map((entity) => ProgramWalletMapper.toDomain(entity));
  }

  /**
   * Найти все кошельки кооператива
   */
  async findByCoopname(coopname: string): Promise<ProgramWalletDomainEntity[]> {
    const entities = await this.repository.find({ coopname }, { order: { username: 'ASC', program_id: 'ASC' } });

    return entities.map((entity) => ProgramWalletMapper.toDomain(entity));
  }

  /**
   * Найти все кошельки программы
   */
  async findByProgramId(program_id: string): Promise<ProgramWalletDomainEntity[]> {
    const entities = await this.repository.find({ program_id }, { order: { username: 'ASC' } });

    return entities.map((entity) => ProgramWalletMapper.toDomain(entity));
  }
}
