import { defineStore } from 'pinia';
import { ref, type Ref } from 'vue';
import { api } from '../api';
import type {
  IProgramExpense,
  IProgramExpensesPagination,
  IGetProgramExpenseInput,
  IGetProgramExpensesInput,
} from './types';

const namespace = 'programExpenseStore';

interface IProgramExpenseStore {
  programExpenses: Ref<IProgramExpensesPagination | null>;
  loadProgramExpenses: (data: IGetProgramExpensesInput) => Promise<void>;
  programExpense: Ref<IProgramExpense | null>;
  loadProgramExpense: (data: IGetProgramExpenseInput) => Promise<void>;
}

export const useProgramExpenseStore = defineStore(namespace, (): IProgramExpenseStore => {
  const programExpenses = ref<IProgramExpensesPagination | null>(null);
  const programExpense = ref<IProgramExpense | null>(null);

  const loadProgramExpenses = async (data: IGetProgramExpensesInput): Promise<void> => {
    programExpenses.value = await api.loadProgramExpenses(data);
  };

  const loadProgramExpense = async (data: IGetProgramExpenseInput): Promise<void> => {
    programExpense.value = await api.loadProgramExpense(data);
  };

  return {
    programExpenses,
    programExpense,
    loadProgramExpenses,
    loadProgramExpense,
  };
});
