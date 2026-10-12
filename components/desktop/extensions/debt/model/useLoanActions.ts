import type { Cooperative } from 'cooptypes';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { DigitalDocument, signDocument } from 'src/shared/lib/document';
import type { IDocumentAggregate } from 'src/entities/Document/model';
import { generateUniqueHash } from 'src/shared/lib/utils/generateUniqueHash';
import { t } from '../i18n';
import {
  cancelLoan,
  createLoan,
  extendLoan,
  generateExtensionStatement,
  generateLoanContract,
  generateLoanPledgeContract,
  signLoanAct,
  type ILoan,
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

/** Данные займа, общие для заявления, договора займа и договора залога. */
interface ILoanBase {
  coopname: string;
  username: string;
  debt_hash: string;
  amount: string;
  due_at: string;
  collateral: string;
}

/** Заявление, договор займа и договор залога, собранные по введённому и ждущие подписи пайщика. */
export interface IPreparedLoan {
  base: ILoanBase;
  statementDoc: Awaited<ReturnType<typeof generateLoanStatement>>;
  contractDoc: Awaited<ReturnType<typeof generateLoanContract>>;
  pledgeDoc: Awaited<ReturnType<typeof generateLoanPledgeContract>>;
}

/** Документы заявления по введённому: договор залога ссылается на договор займа по его дате. */
async function prepareLoanDocuments(base: ILoanBase, method_id: string): Promise<IPreparedLoan> {
  const statementDoc = await generateLoanStatement({ ...base, method_id });
  const contractDoc = await generateLoanContract(base);
  const pledgeDoc = await generateLoanPledgeContract({ ...base, contract_date: String(contractDoc.meta.created_at) });
  return { base, statementDoc, contractDoc, pledgeDoc };
}

/** Подписи пайщика под тремя документами заявления. */
async function signPreparedLoan(prepared: IPreparedLoan, username: string) {
  const statement = await new DigitalDocument(prepared.statementDoc).sign<Cooperative.Registry.GetLoanStatement.Meta>(username, 1);
  const contract = await new DigitalDocument(prepared.contractDoc).sign<Cooperative.Registry.LoanContractShare.Meta>(username, 1);
  const pledge_contract = await new DigitalDocument(prepared.pledgeDoc).sign<Cooperative.Registry.LoanPledgeContract.Meta>(
    username,
    1,
  );
  return { statement, contract, pledge_contract };
}

/** Вторая подпись пайщика под актом, который подписал председатель. */
async function signActDocument(loan: ILoan, username: string) {
  const aggregate = loan.act as IDocumentAggregate | null | undefined;
  if (!aggregate?.rawDocument || !aggregate.document) throw new Error(t('debt.loanDetails.actMissingError'));
  return signDocument(aggregate.rawDocument, username, 2, [aggregate.document]);
}

export function useLoanActions() {
  const { info } = useSystemStore();
  const session = useSessionStore();

  /** Подготовка заявления: пайщик читает документы до подписи. Хэш займа — он же номер договора. */
  async function prepareLoan(draft: ILoanDraft): Promise<IPreparedLoan> {
    const debt_hash = await generateUniqueHash();
    const amount = `${draft.amount.toFixed(draft.precision)} ${draft.symbol}`;
    // Срок — конец выбранного дня по времени цепи.
    const due_at = `${draft.due}T23:59:59`;
    const base = { coopname: info.coopname, username: session.username, debt_hash, amount, due_at, collateral: draft.collateral };
    return prepareLoanDocuments(base, draft.method_id);
  }

  /** Подача заявления: три подписанных документа уходят в цепь одной транзакцией. */
  async function signLoan(prepared: IPreparedLoan) {
    const signed = await signPreparedLoan(prepared, session.username);
    return createLoan({ ...prepared.base, ...signed });
  }

  /** Подпись акта передачи права в залог: после неё сумма уходит кассиру. */
  async function signAct(loan: ILoan) {
    const act = await signActDocument(loan, session.username);
    return signLoanAct({ coopname: info.coopname, username: session.username, debt_hash: loan.debt_hash, act });
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

  return { prepareLoan, signLoan, signAct, cancel, retryPayment, repay, extend };
}
