import { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { ProgramWalletDomainEntity } from '../entities/program-wallet.entity';

export type ProgramWalletRepository = IBlockchainSyncRepository<ProgramWalletDomainEntity>;

export const PROGRAM_WALLET_REPOSITORY = Symbol('ProgramWalletRepository');
