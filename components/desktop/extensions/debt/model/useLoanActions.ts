import type { Cooperative } from 'cooptypes';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { DigitalDocument } from 'src/shared/lib/document';
import { generateUniqueHash } from 'src/shared/lib/utils/generateUniqueHash';
import {
  cancelLoan,
  createLoan,
  extendLoan,
  generateExtensionStatement,
  generateLoanContract,
  generateLoanStatement,
  generateRepaymentStatement,
  repayLoan,
  retryLoanPayment,
} from '../api';

export interface ILoanDraft {
  /** Ключ обеспечения из реестра обеспечения. */
  collateral: string;
  /** Сумма займа числом. */
  amount: number;
  /** Символ и точность валюты кооператива. */
  symbol: string;
  precision: number;
  /** Срок возврата, значение поля даты `YYYY-MM-DD`. */
  due: string;
  /** Платёжный метод пайщика для получения займа. */
  method_id: string;
}

/** Заявление и договор, собранные по введённому и ждущие подписи пайщика. */
export type IPreparedLoan = Awaited<ReturnType<ReturnType<typeof useLoanActions>['prepareLoan']>>;

export function useLoanActions() {
  const { info } = useSystemStore();
  const session = useSessionStore();

  /**
   * Подготовка заявления: заявление и договор собираются по введённому, пайщик
   * читает их до подписи. Хэш займа — он же номер договора.
   */
  async function prepareLoan(draft: ILoanDraft) {
    const debt_hash = await generateUniqueHash();
    const amount = `${draft.amount.toFixed(draft.precision)} ${draft.symbol}`;
    // Срок — конец выбранного дня по времени цепи.
    const due_at = `${draft.due}T23:59:59`;
    const base = {
      coopname: info.coopname,
      username: session.username,
      debt_hash,
      amount,
      due_at,
      collateral: draft.collateral,
    };

    const statementDoc = await generateLoanStatement({ ...base, method_id: draft.method_id });
    const contractDoc = await generateLoanContract(base);
    return { base, statementDoc, contractDoc };
  }

  /**
   * Подача заявления: пайщик подписывает прочитанные заявление и договор, оба
   * документа уходят в цепь одним действием.
   */
  async function signLoan(prepared: IPreparedLoan) {
    const statement = await new DigitalDocument(
      prepared.statementDoc,
    ).sign<Cooperative.Registry.GetLoanStatement.Meta>(session.username, 1);
    const contract = await new DigitalDocument(
      prepared.contractDoc,
    ).sign<Cooperative.Registry.LoanContractShare.Meta>(session.username, 1);

    return createLoan({ ...prepared.base, statement, contract });
  }

  async function cancel(debt_hash: string) {
    return cancelLoan({ coopname: info.coopname, debt_hash });
  }

  async function retryPayment(debt_hash: string) {
    return retryLoanPayment({ coopname: info.coopname, debt_hash });
  }

  /** Возврат с главного кошелька: пайщик подписывает заявление о возврате на сумму. */
  async function repay(debt_hash: string, value: number, symbol: string, precision: number) {
    const amount = `${value.toFixed(precision)} ${symbol}`;
    const base = { coopname: info.coopname, username: session.username, debt_hash, amount };
    const doc = await generateRepaymentStatement(base);
    const statement = await new DigitalDocument(doc).sign<Cooperative.Registry.LoanRepaymentStatement.Meta>(
      session.username,
      1,
    );
    return repayLoan({ ...base, statement });
  }

  /** Продление срока: заявление пайщика уходит председателю в запросы одобрений. */
  async function extend(debt_hash: string, due: string) {
    const new_due_at = `${due}T23:59:59`;
    const base = { coopname: info.coopname, username: session.username, debt_hash, new_due_at };
    const doc = await generateExtensionStatement(base);
    const statement = await new DigitalDocument(doc).sign<Cooperative.Registry.LoanExtensionStatement.Meta>(
      session.username,
      1,
    );
    return extendLoan({ ...base, statement });
  }

  return { prepareLoan, signLoan, cancel, retryPayment, repay, extend };
}
