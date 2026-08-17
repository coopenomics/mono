import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import type { ProgramWalletDomainEntity } from '../entities/program-wallet-domain.entity';

/**
 * Интерфейс репозитория для программных кошельков
 * Предоставляет методы для работы с кошельками в базе данных
 */
export interface ProgramWalletRepository extends IBlockchainSyncRepository<ProgramWalletDomainEntity> {
  /**
   * Найти кошелек по имени пользователя и ID программы
   */
  findByUsernameAndProgramId(username: string, program_id: string): Promise<ProgramWalletDomainEntity | null>;

  /**
   * Найти все кошельки пользователя
   */
  findByUsername(username: string): Promise<ProgramWalletDomainEntity[]>;

  /**
   * Найти все кошельки кооператива
   */
  findByCoopname(coopname: string): Promise<ProgramWalletDomainEntity[]>;

  /**
   * Найти все кошельки программы
   */
  findByProgramId(program_id: string): Promise<ProgramWalletDomainEntity[]>;
}

export const PROGRAM_WALLET_REPOSITORY = Symbol('PROGRAM_WALLET_REPOSITORY');
