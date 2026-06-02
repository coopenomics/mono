import { api } from '../api';
import {
  useProgramExpenseStore,
  type IDeclineProgramExpenseInput,
} from 'app/extensions/capital/entities/ProgramExpense/model';

export function useDeclineProgramExpense() {
  const store = useProgramExpenseStore();

  async function declineProgramExpense(data: IDeclineProgramExpenseInput) {
    const tx = await api.declineProgramExpense(data);
    await store.loadProgramExpenses({});
    return tx;
  }

  return { declineProgramExpense };
}
