import type { Cooperative } from 'cooptypes';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { DigitalDocument } from 'src/shared/lib/document';
import { generateUniqueHash } from 'src/shared/lib/utils/generateUniqueHash';
import { useDebtStore, type ICreateDebtOutput } from 'app/extensions/capital/entities/Debt/model';
import { api } from '../api';

export interface ICreateDebtDraft {
  /** Проект, под долю в котором берётся заём. */
  project_hash: string;
  /** Сумма займа числом. */
  amount: number;
  symbol: string;
  precision: number;
  /** Срок возврата, значение поля даты `YYYY-MM-DD`. */
  due: string;
  /** Платёжный метод пайщика для получения займа. */
  method_id: string;
}

/**
 * Заём под коммиты (Генерация): пайщик подписывает заявление и договор займа
 * под обеспечение имуществом на ответственном хранении; оба документа уходят
 * в цепь одной транзакцией. Дальше — совет, подпись председателя, касса.
 */
export function useCreateDebt() {
  const store = useDebtStore();
  const { info } = useSystemStore();
  const session = useSessionStore();

  async function createDebt(draft: ICreateDebtDraft): Promise<ICreateDebtOutput> {
    const debt_hash = await generateUniqueHash();
    const amount = `${draft.amount.toFixed(draft.precision)} ${draft.symbol}`;
    // Срок — конец выбранного дня по времени цепи.
    const due_at = `${draft.due}T23:59:59`;
    const base = { coopname: info.coopname, username: session.username, debt_hash, amount, due_at };

    // Контракт принимает заявление только по обновлённой доле.
    await api.refreshSegment({ coopname: info.coopname, username: session.username, project_hash: draft.project_hash });

    const statementDoc = await api.generateStatement({ ...base, method_id: draft.method_id });
    const contractDoc = await api.generateContract(base);

    const statement = await new DigitalDocument(statementDoc).sign<Cooperative.Registry.GetLoanStatement.Meta>(
      session.username,
      1,
    );
    const contract = await new DigitalDocument(contractDoc).sign<Cooperative.Registry.LoanContractProperty.Meta>(
      session.username,
      1,
    );

    const transaction = await api.createDebt({
      coopname: info.coopname,
      username: session.username,
      debt_hash,
      project_hash: draft.project_hash,
      amount,
      repaid_at: due_at,
      statement,
      contract,
    });

    await store.loadDebts({});
    return transaction;
  }

  return { createDebt };
}
