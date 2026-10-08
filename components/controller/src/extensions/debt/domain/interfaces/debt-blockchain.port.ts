import type { DebtContract } from 'cooptypes';
import type { InnerTransactResult } from '@coopenomics/innercoop';

/**
 * Действия контракта `debt`, которые подписывает кооператив.
 * Решение совета, подпись председателя и выплата приходят обратными вызовами
 * контрактов soviet и gateway — их здесь нет.
 */
export interface DebtBlockchainPort {
  createLoan(data: DebtContract.Actions.CreateLoan.ICreateLoan): Promise<InnerTransactResult>;
  retryPay(data: DebtContract.Actions.RetryPay.IRetryPay): Promise<InnerTransactResult>;
  cancelLoan(data: DebtContract.Actions.CancelLoan.ICancelLoan): Promise<InnerTransactResult>;
  repayLoan(data: DebtContract.Actions.RepayLoan.IRepayLoan): Promise<InnerTransactResult>;
  extendLoan(data: DebtContract.Actions.ExtendLoan.IExtendLoan): Promise<InnerTransactResult>;
  sweep(data: DebtContract.Actions.Sweep.ISweep): Promise<InnerTransactResult>;
}

export const DEBT_BLOCKCHAIN_PORT = Symbol('DebtBlockchainPort');
