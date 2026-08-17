import { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { ProgramPropertyDomainEntity } from '../entities/program-property.entity';

export type ProgramPropertyRepository = IBlockchainSyncRepository<ProgramPropertyDomainEntity>;

export const PROGRAM_PROPERTY_REPOSITORY = Symbol('ProgramPropertyRepository');
