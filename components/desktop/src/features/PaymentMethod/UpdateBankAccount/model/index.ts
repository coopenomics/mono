import { api } from '../api';

export interface IBankTransferData {
  account_number: string;
  bank_name: string;
  card_number?: string | null;
  currency: string;
  details: {
    bik: string;
    corr: string;
  };
}

export interface IUpdateBranchBankAccount {
  username: string;
  method_id: string;
  method_type: string;
  data: IBankTransferData;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}


export function useUpdateBranchBankAccount() {

  async function updateBankAccount(data: IUpdateBranchBankAccount) {
    data.is_default = true

    // Убираем ненужные поля TODO: очевидно что так делать не надо
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { created_at, updated_at, method_type, ...rest } = data;

    return await api.updateBankAccount(rest)
  }

  return {
    updateBankAccount
  }
}
