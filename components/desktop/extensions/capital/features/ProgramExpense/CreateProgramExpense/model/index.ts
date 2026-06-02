import { api } from '../api';
import {
  useProgramExpenseStore,
  type ICreateProgramExpenseInput,
} from 'app/extensions/capital/entities/ProgramExpense/model';

export function useCreateProgramExpense() {
  const store = useProgramExpenseStore();

  async function createProgramExpense(data: ICreateProgramExpenseInput) {
    const tx = await api.createProgramExpense(data);
    await store.loadProgramExpenses({});
    return tx;
  }

  return { createProgramExpense };
}
