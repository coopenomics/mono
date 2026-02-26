import { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { DebtDomainEntity } from '../entities/debt.entity';

export interface DebtRepository extends IBlockchainSyncRepository<DebtDomainEntity> {
  create(debt: Omit<DebtDomainEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<DebtDomainEntity>;
  findById(_id: string): Promise<DebtDomainEntity | null>;
  findAll(): Promise<DebtDomainEntity[]>;
  findByUsername(username: string): Promise<DebtDomainEntity[]>;
  findByProjectHash(projectHash: string): Promise<DebtDomainEntity[]>;
  findByStatus(status: string): Promise<DebtDomainEntity[]>;
  update(entity: DebtDomainEntity): Promise<DebtDomainEntity>;
  delete(_id: string): Promise<void>;
}

export const DEBT_REPOSITORY = Symbol('DebtRepository');
