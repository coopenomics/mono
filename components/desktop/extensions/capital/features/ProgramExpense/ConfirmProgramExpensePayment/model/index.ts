import { api } from '../api';
import {
  useProgramExpenseStore,
  type IConfirmProgramExpensePaymentInput,
} from 'app/extensions/capital/entities/ProgramExpense/model';

export function useConfirmProgramExpensePayment() {
  const store = useProgramExpenseStore();

  async function confirmProgramExpensePayment(data: IConfirmProgramExpensePaymentInput) {
    const tx = await api.confirmProgramExpensePayment(data);
    await store.loadProgramExpenses({});
    return tx;
  }

  return { confirmProgramExpensePayment };
}
