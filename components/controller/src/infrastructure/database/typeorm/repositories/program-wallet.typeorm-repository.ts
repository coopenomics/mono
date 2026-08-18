import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProgramWalletDomainEntity } from '~/domain/wallet/entities/program-wallet-domain.entity';
import { ProgramWalletTypeormEntity } from '../entities/program-wallet.typeorm-entity';
import { ProgramWalletMapper } from '../mappers/program-wallet.mapper';
import type { ProgramWalletRepository } from '~/domain/wallet/repositories/program-wallet.repository';
import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { BaseBlockchainRepository, EntityVersioningService } from '@coopenomics/extension-kit/sync';
import type { IProgramWalletBlockchainData } from '~/domain/wallet/interfaces/program-wallet-blockchain.interface';
import type { IProgramWalletDatabaseData } from '~/domain/wallet/interfaces/program-wallet-database.interface';

/**
 * TypeORM реализация репозитория программных кошельков
 * Обеспечивает синхронизацию данных кошельков между блокчейном и базой данных
 */
@Injectable()
export class ProgramWalletTypeormRepository
  extends BaseBlockchainRepository<ProgramWalletDomainEntity, ProgramWalletTypeormEntity>
  implements ProgramWalletRepository, IBlockchainSyncRepository<ProgramWalletDomainEntity>
{
  constructor(
    @InjectRepository(ProgramWalletTypeormEntity)
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
    const entity = await this.repository.findOne({
      where: { username, program_id },
    });

    return entity ? ProgramWalletMapper.toDomain(entity) : null;
  }

  /**
   * Найти все кошельки пользователя
   */
  async findByUsername(username: string): Promise<ProgramWalletDomainEntity[]> {
    const entities = await this.repository.find({
      where: { username },
      order: { program_id: 'ASC' },
    });

    return entities.map((entity) => ProgramWalletMapper.toDomain(entity));
  }

  /**
   * Найти все кошельки кооператива
   */
  async findByCoopname(coopname: string): Promise<ProgramWalletDomainEntity[]> {
    const entities = await this.repository.find({
      where: { coopname },
      order: { username: 'ASC', program_id: 'ASC' },
    });

    return entities.map((entity) => ProgramWalletMapper.toDomain(entity));
  }

  /**
   * Найти все кошельки программы
   */
  async findByProgramId(program_id: string): Promise<ProgramWalletDomainEntity[]> {
    const entities = await this.repository.find({
      where: { program_id },
      order: { username: 'ASC' },
    });

    return entities.map((entity) => ProgramWalletMapper.toDomain(entity));
  }
}
