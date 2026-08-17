import { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { ProgramWithdrawDomainEntity } from '../entities/program-withdraw.entity';

export type ProgramWithdrawRepository = IBlockchainSyncRepository<ProgramWithdrawDomainEntity>;

export const PROGRAM_WITHDRAW_REPOSITORY = Symbol('ProgramWithdrawRepository');
