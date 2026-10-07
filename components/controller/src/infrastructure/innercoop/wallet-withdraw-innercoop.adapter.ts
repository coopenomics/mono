import { Injectable } from '@nestjs/common';
import type { IWalletWithdrawPort, InnerCreateWithdrawInput, InnerCreateWithdrawResult } from '@coopenomics/innercoop';
import { WalletInteractor } from '~/application/wallet/interactors/wallet.interactor';

/**
 * Реализация `IWalletWithdrawPort` поверх заявки на возврат из кошелька: тот
 * же путь, что у пайщика со страницы кошелька — платёж шлюза, заявка в цепи,
 * вопрос совету. Расширение не повторяет эти шаги у себя.
 */
@Injectable()
export class WalletWithdrawInnercoopAdapter implements IWalletWithdrawPort {
  constructor(private readonly wallet: WalletInteractor) {}

  createWithdraw(input: InnerCreateWithdrawInput): Promise<InnerCreateWithdrawResult> {
    return this.wallet.createWithdraw(input);
  }
}
