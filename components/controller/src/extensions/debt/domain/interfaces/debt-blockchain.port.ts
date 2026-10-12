import type { DebtContract } from 'cooptypes';
import type { InnerTransactResult } from '@coopenomics/innercoop';

/**
 * Действия контракта `debt`, которые подписывает кооператив.
 * Решение совета, подпись председателя и выплата приходят обратными вызовами
 * контрактов soviet и gateway — их здесь нет.
 */
export interface DebtBlockchainPort {
  /** Заявление, договор займа и договор залога — одной транзакцией. */
  createLoan(
    data: DebtContract.Actions.CreateLoan.ICreateLoan,
    pledge: DebtContract.Actions.LoanPledge.ILoanPledge
  ): Promise<InnerTransactResult>;
  /** Председатель подписал договор залога и акт; договор займа подписывается через одобрение. */
  chairmanSign(data: DebtContract.Actions.LoanChSign.ILoanChSign): Promise<InnerTransactResult>;
  /** Пайщик подписал акт передачи права в залог. */
  signAct(data: DebtContract.Actions.LoanActSign.ILoanActSign): Promise<InnerTransactResult>;
  retryPay(data: DebtContract.Actions.RetryPay.IRetryPay): Promise<InnerTransactResult>;
  cancelLoan(data: DebtContract.Actions.CancelLoan.ICancelLoan): Promise<InnerTransactResult>;
  repayLoan(data: DebtContract.Actions.RepayLoan.IRepayLoan): Promise<InnerTransactResult>;
  extendLoan(data: DebtContract.Actions.ExtendLoan.IExtendLoan): Promise<InnerTransactResult>;
  sweep(data: DebtContract.Actions.Sweep.ISweep): Promise<InnerTransactResult>;
}

export const DEBT_BLOCKCHAIN_PORT = Symbol('DebtBlockchainPort');
