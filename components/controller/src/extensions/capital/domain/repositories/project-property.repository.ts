import { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { ProjectPropertyDomainEntity } from '../entities/project-property.entity';

export type ProjectPropertyRepository = IBlockchainSyncRepository<ProjectPropertyDomainEntity>;

export const PROJECT_PROPERTY_REPOSITORY = Symbol('ProjectPropertyRepository');
