import { Inject, Injectable } from '@nestjs/common';
import type {
  IProgramWalletPort,
  IUserWalletPort,
  InnerProgramWallet,
  InnerProgramWalletFilter,
  InnerUserWallet,
} from '@coopenomics/innercoop';
import { WALLET_DOMAIN_PORT, type WalletDomainPort } from '~/domain/wallet/ports/wallet-domain.port';
import { USER_WALLET_REPOSITORY, type UserWalletRepository } from '~/domain/wallet/repositories/user-wallet.repository';

/** Реализация `IProgramWalletPort` поверх кошельков целевых программ. */
@Injectable()
export class ProgramWalletInnercoopAdapter implements IProgramWalletPort {
  constructor(
    @Inject(WALLET_DOMAIN_PORT)
    private readonly walletDomainPort: WalletDomainPort
  ) {}

  async getProgramWallet(filter: InnerProgramWalletFilter): Promise<InnerProgramWallet | null> {
    return this.walletDomainPort.getProgramWallet(filter);
  }

  async getProgramWallets(filter: InnerProgramWalletFilter): Promise<InnerProgramWallet[]> {
    return this.walletDomainPort.getProgramWallets(filter);
  }
}

/**
 * Реализация `IUserWalletPort` поверх долей пайщиков в общих кошельках.
 *
 * Наружу отданы только выборки. Записывать доли расширению нельзя: они
 * приходят из цепи и переписываются синхронизацией, а не прикладным кодом.
 */
@Injectable()
export class UserWalletInnercoopAdapter implements IUserWalletPort {
  constructor(
    @Inject(USER_WALLET_REPOSITORY)
    private readonly userWalletRepository: UserWalletRepository
  ) {}

  async findByWalletAndUsername(
    coopname: string,
    walletName: string,
    username: string
  ): Promise<InnerUserWallet | null> {
    return this.userWalletRepository.findByWalletAndUsername(coopname, walletName, username);
  }

  async findByUsername(coopname: string, username: string): Promise<InnerUserWallet[]> {
    return this.userWalletRepository.findByUsername(coopname, username);
  }

  async findByWallet(coopname: string, walletName: string): Promise<InnerUserWallet[]> {
    return this.userWalletRepository.findByWallet(coopname, walletName);
  }
}
