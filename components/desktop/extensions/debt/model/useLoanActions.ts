import type { Cooperative } from 'cooptypes';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { DigitalDocument } from 'src/shared/lib/document';
import type { IDocumentAggregate } from 'src/entities/Document/model';
import { useSignDocuments, type SignDocumentsRequest, type SignedDocumentsMap } from 'src/shared/lib/sign-documents';
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


/** Документы заявления на подпись: договор займа, договор залога, заявление — в таком порядке читает пайщик. */
function loanSignRequest(prepared: IPreparedLoan): SignDocumentsRequest {
  return {
    title: t('debt.createDialog.reviewDialogTitle'),
    documents: [
      { key: 'contract', title: t('debt.createDialog.contractTitle'), document: prepared.contractDoc },
      { key: 'pledge_contract', title: t('debt.createDialog.pledgeContractTitle'), document: prepared.pledgeDoc },
      { key: 'statement', title: t('debt.createDialog.statementTitle'), document: prepared.statementDoc },
    ],
  };
}

/** Акт с подписью председателя на вторую подпись пайщика. */
function actSignRequest(loan: ILoan): SignDocumentsRequest {
  const aggregate = loan.act as IDocumentAggregate | null | undefined;
  if (!aggregate?.rawDocument || !aggregate.document) throw new Error(t('debt.loanDetails.actMissingError'));
  return {
    title: t('debt.loanDetails.actTitle'),
    documents: [{ key: 'act', title: t('debt.loanDetails.actTitle'), document: aggregate.rawDocument, signatureId: 2, existing: [aggregate.document] }],
  };
}

export function useLoanActions() {
  const { info } = useSystemStore();
  const session = useSessionStore();
  const { signDocuments } = useSignDocuments();

  /** Подготовка заявления: пайщик читает документы до подписи. Хэш займа — он же номер договора. */
  async function prepareLoan(draft: ILoanDraft): Promise<IPreparedLoan> {
    const debt_hash = await generateUniqueHash();
    const amount = `${draft.amount.toFixed(draft.precision)} ${draft.symbol}`;
    // Срок — конец выбранного дня по времени цепи.
    const due_at = `${draft.due}T23:59:59`;
    const base = { coopname: info.coopname, username: session.username, debt_hash, amount, due_at, collateral: draft.collateral };
    return prepareLoanDocuments(base, draft.method_id);
  }

  /**
   * Подача заявления: пайщик читает договор займа, договор залога и заявление
   * в едином окне подписи; три подписанных документа уходят в цепь одной
   * транзакцией. `null` — пайщик закрыл окно, заявление не подано.
   */
  async function signLoan(prepared: IPreparedLoan): Promise<SignedDocumentsMap | null> {
    const signed = await signDocuments(loanSignRequest(prepared));
    if (!signed) return null;
    await createLoan({ ...prepared.base, statement: signed.statement, contract: signed.contract, pledge_contract: signed.pledge_contract });
    return signed;
  }

  /**
   * Подпись акта передачи права в залог: пайщик читает акт с подписью
   * председателя и ставит вторую подпись; после неё сумма уходит кассиру.
   * `false` — окно закрыто без подписи.
   */
  async function signAct(loan: ILoan): Promise<boolean> {
    const signed = await signDocuments(actSignRequest(loan));
    if (!signed) return false;
    await signLoanAct({ coopname: info.coopname, username: session.username, debt_hash: loan.debt_hash, act: signed.act });
    return true;
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
