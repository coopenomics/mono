import { defineStore } from 'pinia'
import type { RegistrySource } from 'src/shared/lib/registry-source'
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
  loadProcess: (input: IProcessGetInput, source?: RegistrySource) => Promise<IProcessView | undefined>
  loadLatestSnapshot: (input: IProcessGetInput) => Promise<IProcessSnapshot | null>
  loadProcesses: (input: IProcessListInput, source?: RegistrySource) => Promise<IProcessListResult | undefined>
}

export const useProcessStore = defineStore(namespace, (): IProcessStore => {
  const loading = ref(false)

  async function loadProcess(input: IProcessGetInput, source?: RegistrySource): Promise<IProcessView | undefined> {
    loading.value = true
    try {
      return await processApi.getProcess(input, source)
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
    source?: RegistrySource,
  ): Promise<IProcessListResult | undefined> {
    loading.value = true
    try {
      return await processApi.listProcesses(input, source)
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
