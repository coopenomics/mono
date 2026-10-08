import { Inject, Injectable } from '@nestjs/common';
import { DebtContract } from 'cooptypes';
import httpStatus from 'http-status';
import { DomainError } from '@coopenomics/extension-kit';
import { CHAIN_PORT, VAULT_PORT, type IChainPort, type IVaultPort, type InnerTransactResult } from '@coopenomics/innercoop';
import { DebtBlockchainPort } from '../../../domain/interfaces/debt-blockchain.port';

/**
 * Адаптер контракта `debt`: действия подписываются ключом кооператива
 * (`active`), документы с подписью пайщика идут частью данных действия.
 */
@Injectable()
export class DebtBlockchainAdapter implements DebtBlockchainPort {
  constructor(
    @Inject(CHAIN_PORT) private readonly chain: IChainPort,
    @Inject(VAULT_PORT) private readonly vault: IVaultPort
  ) {}

  private async initWithCoopKey(coopname: string): Promise<void> {
    const wif = await this.vault.getWif(coopname);
    if (!wif) {
      throw new DomainError('DEBT_PRIVATE_KEY_NOT_FOUND', {}, httpStatus.BAD_GATEWAY);
    }
    this.chain.initialize(coopname, wif);
  }

  private async send(coopname: string, name: string, data: Record<string, any>): Promise<InnerTransactResult> {
    await this.initWithCoopKey(coopname);
    return this.chain.transact({
      account: DebtContract.contractName.production,
      name,
      authorization: [{ actor: coopname, permission: 'active' }],
      data,
    });
  }

  createLoan(data: DebtContract.Actions.CreateLoan.ICreateLoan): Promise<InnerTransactResult> {
    return this.send(data.coopname, DebtContract.Actions.CreateLoan.actionName, data);
  }

  retryPay(data: DebtContract.Actions.RetryPay.IRetryPay): Promise<InnerTransactResult> {
    return this.send(data.coopname, DebtContract.Actions.RetryPay.actionName, data);
  }

  cancelLoan(data: DebtContract.Actions.CancelLoan.ICancelLoan): Promise<InnerTransactResult> {
    return this.send(data.coopname, DebtContract.Actions.CancelLoan.actionName, data);
  }

  repayLoan(data: DebtContract.Actions.RepayLoan.IRepayLoan): Promise<InnerTransactResult> {
    return this.send(data.coopname, DebtContract.Actions.RepayLoan.actionName, data);
  }

  extendLoan(data: DebtContract.Actions.ExtendLoan.IExtendLoan): Promise<InnerTransactResult> {
    return this.send(data.coopname, DebtContract.Actions.ExtendLoan.actionName, data);
  }

  sweep(data: DebtContract.Actions.Sweep.ISweep): Promise<InnerTransactResult> {
    return this.send(data.coopname, DebtContract.Actions.Sweep.actionName, data);
  }
}
