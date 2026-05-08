import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { ledger2Api } from '../api'
import type {
  ILedger2Account,
  ILedger2Wallet,
  ILedger2Operation,
  ILedger2HistoryResponse,
  ILedger2HistoryFilterInput,
  ILedger2PostingsResponse,
  ILedger2PostingsFilterInput,
  ILedger2AdjustmentResult,
  IWalmoveInput,
} from '../types'

const namespace = 'ledger2Store'

interface ILedger2Store {
  accounts: Ref<ILedger2Account[]>
  wallets: Ref<ILedger2Wallet[]>
  loading: Ref<boolean>
  loadAccounts: (coopname: string) => Promise<ILedger2Account[]>
  loadWallets: (coopname: string) => Promise<ILedger2Wallet[]>
  loadHistory: (input: ILedger2HistoryFilterInput) => Promise<ILedger2HistoryResponse | undefined>
  loadPostings: (input: ILedger2PostingsFilterInput) => Promise<ILedger2PostingsResponse | undefined>
  getAccountById: (id: number) => ILedger2Account | undefined
  /** `name` — eosio::name кошелька (`w.<contract>.<waltype>`). */
  getWalletByName: (name: string) => ILedger2Wallet | undefined
  walmoveWallets: (input: IWalmoveInput) => Promise<ILedger2AdjustmentResult>
}

export const useLedger2Store = defineStore(namespace, (): ILedger2Store => {
  const accounts = ref<ILedger2Account[]>([])
  const wallets = ref<ILedger2Wallet[]>([])
  const loading = ref(false)

  async function loadAccounts(coopname: string): Promise<ILedger2Account[]> {
    loading.value = true
    try {
      accounts.value = await ledger2Api.getAccounts(coopname)
      return accounts.value
    } finally {
      loading.value = false
    }
  }

  async function loadWallets(coopname: string): Promise<ILedger2Wallet[]> {
    loading.value = true
    try {
      wallets.value = await ledger2Api.getWallets(coopname)
      return wallets.value
    } finally {
      loading.value = false
    }
  }

  async function loadHistory(
    input: ILedger2HistoryFilterInput,
  ): Promise<ILedger2HistoryResponse | undefined> {
    return ledger2Api.getHistory(input)
  }

  async function loadPostings(
    input: ILedger2PostingsFilterInput,
  ): Promise<ILedger2PostingsResponse | undefined> {
    return ledger2Api.getPostings(input)
  }

  function getAccountById(id: number): ILedger2Account | undefined {
    return accounts.value.find((a) => a.id === id)
  }

  function getWalletByName(name: string): ILedger2Wallet | undefined {
    return wallets.value.find((w) => w.id === name)
  }

  async function walmoveWallets(input: IWalmoveInput): Promise<ILedger2AdjustmentResult> {
    return ledger2Api.walmoveWallets(input)
  }

  return {
    accounts,
    wallets,
    loading,
    loadAccounts,
    loadWallets,
    loadHistory,
    loadPostings,
    getAccountById,
    getWalletByName,
    walmoveWallets,
  }
})

export type { ILedger2Operation }
