import { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { StateDomainEntity } from '../entities/state.entity';

export interface StateRepository extends IBlockchainSyncRepository<StateDomainEntity> {
  create(state: Omit<StateDomainEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<StateDomainEntity>;
  findById(_id: string): Promise<StateDomainEntity | null>;
  findAll(): Promise<StateDomainEntity[]>;
  findByCoopname(coopname: string): Promise<StateDomainEntity | null>;
  update(entity: StateDomainEntity): Promise<StateDomainEntity>;
  delete(_id: string): Promise<void>;
}

export const STATE_REPOSITORY = Symbol('StateRepository');
