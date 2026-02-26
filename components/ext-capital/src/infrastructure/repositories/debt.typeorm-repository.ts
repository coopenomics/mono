import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DebtRepository } from '../../domain/repositories/debt.repository';
import { DebtDomainEntity } from '../../domain/entities/debt.entity';
import { DebtTypeormEntity } from '../entities/debt.typeorm-entity';
import { DebtMapper } from '../mappers/debt.mapper';
import { CAPITAL_DATABASE_CONNECTION } from '../database/capital-database.module';
import type { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseBlockchainRepository } from '~/shared/sync/repositories/base-blockchain.repository';
import { EntityVersioningService } from '~/shared/sync/services/entity-versioning.service';
import type { IDebtDatabaseData } from '../../domain/interfaces/debt-database.interface';
import type { IDebtBlockchainData } from '../../domain/interfaces/debt-blockchain.interface';

@Injectable()
export class DebtTypeormRepository
  extends BaseBlockchainRepository<DebtDomainEntity, DebtTypeormEntity>
  implements DebtRepository, IBlockchainSyncRepository<DebtDomainEntity>
{
  constructor(
    @InjectRepository(DebtTypeormEntity, CAPITAL_DATABASE_CONNECTION)
    repository: Repository<DebtTypeormEntity>,
    entityVersioningService: EntityVersioningService
  ) {
    super(repository, entityVersioningService);
  }

  protected getMapper() {
    return {
      toDomain: DebtMapper.toDomain,
      toEntity: DebtMapper.toEntity,
    };
  }


  protected createDomainEntity(databaseData: IDebtDatabaseData, blockchainData: IDebtBlockchainData): DebtDomainEntity {
    return new DebtDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return DebtDomainEntity.getSyncKey();
  }

  async create(debt: DebtDomainEntity): Promise<DebtDomainEntity> {
    const entity = this.repository.create(DebtMapper.toEntity(debt));
    const savedEntity = await this.repository.save(entity);
    return DebtMapper.toDomain(savedEntity);
  }

  async findByUsername(username: string): Promise<DebtDomainEntity[]> {
    const entities = await this.repository.find({ where: { username } });
    return entities.map((entity) => DebtMapper.toDomain(entity));
  }

  async findByProjectHash(projectHash: string): Promise<DebtDomainEntity[]> {
    const entities = await this.repository.find({ where: { project_hash: projectHash } });
    return entities.map((entity) => DebtMapper.toDomain(entity));
  }

  async findByStatus(status: string): Promise<DebtDomainEntity[]> {
    const entities = await this.repository.find({ where: { status: status as any } });
    return entities.map((entity) => DebtMapper.toDomain(entity));
  }
}
