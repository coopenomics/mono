import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import type { ExpenseCreatePayload } from 'src/shared/ui/domain/ExpenseCreateDialog';
import { createProgramExpense } from '../api';
import { useProgramExpenseStore } from 'app/extensions/capital/entities/ProgramExpense/model';

/**
 * Кошелёк-источник программных расходов capital — кооперативный пул расходов
 * (его же на чейн ставит capital::createpgexp; здесь — для текста СЗ-документа).
 */
export const PROGRAM_EXPENSE_SOURCE_WALLET = 'w.cap.pgexp';

/** Ключ черновика формы создания программного расхода. */
export const PROGRAM_EXPENSE_DRAFT_KEY = 'mp:capital:create-program-expense:draft';

/**
 * Программная подача СЗ на чейн: форму, документ и подпись собирает общий
 * виджет шасси `ExpenseCreateDialog` — здесь только capital-мутация
 * (инициирует capital::createpgexp: счётчики пула + inline expense::createexp).
 */
export function useCreateProgramExpense() {
  const { info } = useSystemStore();
  const session = useSessionStore();
  const store = useProgramExpenseStore();

  async function submitProgramExpense(payload: ExpenseCreatePayload) {
    const result = await createProgramExpense({
      coopname: info.coopname,
      expense_hash: payload.expense_hash,
      creator: session.username,
      items: payload.items,
      description: payload.description,
      statement: payload.statement,
    } as any);

    await store.loadProgramExpenses({ coopname: info.coopname });
    return result;
  }

  return { submitProgramExpense };
}
