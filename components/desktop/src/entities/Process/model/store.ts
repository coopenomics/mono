import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { processApi } from '../api'
import type {
  IProcessGetInput,
  IProcessListInput,
  IProcessListResult,
  IProcessSnapshot,
  IProcessView,
} from '../types'

const namespace = 'processStore'

interface IProcessStore {
  loading: Ref<boolean>
  loadProcess: (input: IProcessGetInput) => Promise<IProcessView | undefined>
  loadLatestSnapshot: (input: IProcessGetInput) => Promise<IProcessSnapshot | null>
  loadProcesses: (input: IProcessListInput) => Promise<IProcessListResult | undefined>
}

export const useProcessStore = defineStore(namespace, (): IProcessStore => {
  const loading = ref(false)

  async function loadProcess(input: IProcessGetInput): Promise<IProcessView | undefined> {
    loading.value = true
    try {
      return await processApi.getProcess(input)
    } finally {
      loading.value = false
    }
  }

  async function loadLatestSnapshot(
    input: IProcessGetInput,
  ): Promise<IProcessSnapshot | null> {
    const view = await loadProcess(input)
    return processApi.pickLatestSnapshot(view)
  }

  async function loadProcesses(
    input: IProcessListInput,
  ): Promise<IProcessListResult | undefined> {
    loading.value = true
    try {
      return await processApi.listProcesses(input)
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    loadProcess,
    loadLatestSnapshot,
    loadProcesses,
  }
})
