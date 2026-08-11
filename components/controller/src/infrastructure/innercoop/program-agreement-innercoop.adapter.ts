import { Inject, Injectable } from '@nestjs/common';
import type {
  IProgramAgreementPort,
  InnerProgramSignature,
  InnerSignProgramAgreementInput,
  InnerTransactResult,
} from '@coopenomics/innercoop';
import {
  USER_AGREEMENT_REPOSITORY,
  type UserAgreementRepository,
} from '~/domain/wallet/repositories/user-agreement.repository';
import { WALLET_BLOCKCHAIN_PORT, type WalletBlockchainPort } from '~/domain/wallet/ports/wallet-blockchain.port';

/**
 * Реализация `IProgramAgreementPort`.
 *
 * Из кошелькового контура наружу отданы две операции — узнать, подписано ли
 * соглашение, и записать подпись. Возвраты паевого, выписки и прочее движение
 * средств расширению не даются.
 */
@Injectable()
export class ProgramAgreementInnercoopAdapter implements IProgramAgreementPort {
  constructor(
    @Inject(USER_AGREEMENT_REPOSITORY)
    private readonly userAgreementRepository: UserAgreementRepository,
    @Inject(WALLET_BLOCKCHAIN_PORT)
    private readonly walletBlockchainPort: WalletBlockchainPort
  ) {}

  async findProgramSignature(
    coopname: string,
    username: string,
    programId: number
  ): Promise<InnerProgramSignature | null> {
    const owner = await this.userAgreementRepository.findByUsername(coopname, username);
    // `present === false` — соглашение снято в цепи: подписи больше нет.
    if (!owner || owner.present === false) {
      return null;
    }
    return owner.findProgram(programId) ?? null;
  }

  async signProgramAgreement(input: InnerSignProgramAgreementInput): Promise<InnerTransactResult> {
    return this.walletBlockchainPort.signProgramAgreement(input);
  }
}
