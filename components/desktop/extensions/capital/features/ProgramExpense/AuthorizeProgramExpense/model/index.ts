import { api } from '../api';
import {
  useProgramExpenseStore,
  type IAuthorizeProgramExpenseInput,
} from 'app/extensions/capital/entities/ProgramExpense/model';

export function useAuthorizeProgramExpense() {
  const store = useProgramExpenseStore();

  async function authorizeProgramExpense(data: IAuthorizeProgramExpenseInput) {
    const tx = await api.authorizeProgramExpense(data);
    await store.loadProgramExpenses({});
    return tx;
  }

  return { authorizeProgramExpense };
}
