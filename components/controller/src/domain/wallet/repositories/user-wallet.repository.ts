import type { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import type { UserWalletDomainEntity } from '../entities/user-wallet-domain.entity';

/**
 * Репозиторий L3 кошельков пайщиков (`ledger2::userwallets`, Эпик 3).
 */
export interface UserWalletRepository extends IBlockchainSyncRepository<UserWalletDomainEntity> {
  /** L3-запись по уникальному (coopname, wallet_name, username). */
  findByWalletAndUsername(
    coopname: string,
    wallet_name: string,
    username: string
  ): Promise<UserWalletDomainEntity | null>;

  /** Все L3 пайщика во всех USER_SHARED-кошельках кооператива. */
  findByUsername(coopname: string, username: string): Promise<UserWalletDomainEntity[]>;

  /** Все L3-записи конкретного кошелька (для отчётов/председателя). */
  findByWallet(coopname: string, wallet_name: string): Promise<UserWalletDomainEntity[]>;

  /** Все L3-записи кооператива. */
  findByCoopname(coopname: string): Promise<UserWalletDomainEntity[]>;
}

export const USER_WALLET_REPOSITORY = Symbol('USER_WALLET_REPOSITORY');
