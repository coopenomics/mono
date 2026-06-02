import { api } from '../api';
import {
  useProgramExpenseStore,
  type IApproveProgramExpenseInput,
} from 'app/extensions/capital/entities/ProgramExpense/model';

export function useApproveProgramExpense() {
  const store = useProgramExpenseStore();

  async function approveProgramExpense(data: IApproveProgramExpenseInput) {
    const tx = await api.approveProgramExpense(data);
    await store.loadProgramExpenses({});
    return tx;
  }

  return { approveProgramExpense };
}
