import { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { ProjectPropertyDomainEntity } from '../entities/project-property.entity';

export type ProjectPropertyRepository = IBlockchainSyncRepository<ProjectPropertyDomainEntity>;

export const PROJECT_PROPERTY_REPOSITORY = Symbol('ProjectPropertyRepository');
