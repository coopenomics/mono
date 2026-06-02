import { api } from '../api';
import {
  useProgramExpenseStore,
  type ITopupProgramExpensePoolInput,
} from 'app/extensions/capital/entities/ProgramExpense/model';

export function useTopupProgramExpensePool() {
  const store = useProgramExpenseStore();

  async function topupProgramExpensePool(data: ITopupProgramExpensePoolInput) {
    const tx = await api.topupProgramExpensePool(data);
    await store.loadProgramExpenses({});
    return tx;
  }

  return { topupProgramExpensePool };
}
