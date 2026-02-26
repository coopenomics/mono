import { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { ProgramWalletDomainEntity } from '../entities/program-wallet.entity';

export type ProgramWalletRepository = IBlockchainSyncRepository<ProgramWalletDomainEntity>;

export const PROGRAM_WALLET_REPOSITORY = Symbol('ProgramWalletRepository');
