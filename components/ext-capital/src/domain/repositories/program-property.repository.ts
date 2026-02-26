import { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { ProgramPropertyDomainEntity } from '../entities/program-property.entity';

export type ProgramPropertyRepository = IBlockchainSyncRepository<ProgramPropertyDomainEntity>;

export const PROGRAM_PROPERTY_REPOSITORY = Symbol('ProgramPropertyRepository');
