import { defineStore } from 'pinia'
import { ref, Ref } from 'vue'
import { api } from '../api'
import type { IAccount, IAccounts, IGetAccounts } from '../types';

const namespace = 'accountStore';

interface IAccountStore {
  account: Ref<IAccount | undefined>
  accounts: Ref<IAccounts>
  getAccount: (username: string) => Promise<IAccount | undefined>;
  getAccounts: (data?: IGetAccounts) => Promise<IAccounts>;
  deleteAccount: (username: string) => Promise<boolean>;
}

export const useAccountStore = defineStore(namespace, (): IAccountStore => {
  const account = ref<IAccount>()
  const accounts = ref<IAccounts>({items: [], totalCount: 0, totalPages: 0, currentPage: 1})

  const getAccount = async (username: string): Promise<IAccount | undefined> => {
    account.value = await api.getAccount(username);
    return account.value
  };
  
  const getAccounts = async(data?: IGetAccounts): Promise<IAccounts> => {
    accounts.value = await api.getAccounts(data);
    return accounts.value
  }

  const deleteAccount = async (username: string): Promise<boolean> => {
    const result = await api.deleteAccount(username);
    // Убираем удалённый аккаунт из локального реестра без перезапроса.
    accounts.value.items = accounts.value.items.filter((a) => a.username !== username);
    accounts.value.totalCount = Math.max(0, accounts.value.totalCount - 1);
    return result;
  }

  return {
    account,
    accounts,
    getAccount,
    getAccounts,
    deleteAccount
  }
})
