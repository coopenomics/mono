import { CAPITAL_STATE_STORE } from '../database/capital-stores';
import { type TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { StateRepository } from '../../domain/repositories/state.repository';
import { StateDomainEntity } from '../../domain/entities/state.entity';
import { StateRecord } from '../entities/state.record';
import { StateMapper } from '../mappers/state.mapper';
import { BaseChainRepository, ChainVersioningService, type IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import type { IStateBlockchainData } from '../../domain/interfaces/state-blockchain.interface';
import type { IStateDatabaseData } from '../../domain/interfaces/state-database.interface';

@Injectable()
export class StateKyselyRepository
  extends BaseChainRepository<StateDomainEntity, StateRecord>
  implements StateRepository, IBlockchainSyncRepository<StateDomainEntity>
{
  constructor(
    @Inject(CAPITAL_STATE_STORE) repository: TableStore<StateRecord>,
    @Inject(ChainVersioningService) versioning: ChainVersioningService
  ) {
    super(repository, versioning);
  }

  protected getMapper() {
    return {
      toDomain: StateMapper.toDomain,
      toEntity: StateMapper.toEntity,
    };
  }


  protected getSyncKey(): string {
    return StateDomainEntity.getSyncKey();
  }

  protected createDomainEntity(databaseData: IStateDatabaseData, blockchainData: IStateBlockchainData): StateDomainEntity {
    return new StateDomainEntity(databaseData, blockchainData);
  }

  async create(state: Omit<StateDomainEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<StateDomainEntity> {
    const entity = this.repository.create(StateMapper.toEntity(state));
    const savedEntity = await this.repository.save(entity);
    return StateMapper.toDomain(savedEntity);
  }

  async findByCoopname(coopname: string): Promise<StateDomainEntity | null> {
    const entity = await this.repository.findOne({ coopname });
    return entity ? StateMapper.toDomain(entity) : null;
  }
}
