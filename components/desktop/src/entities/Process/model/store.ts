import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { processApi } from '../api'
import type { IProcessGetInput, IProcessSnapshot, IProcessView } from '../types'

const namespace = 'processStore'

interface IProcessStore {
  loading: Ref<boolean>
  loadProcess: (input: IProcessGetInput) => Promise<IProcessView | undefined>
  loadLatestSnapshot: (input: IProcessGetInput) => Promise<IProcessSnapshot | null>
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

  return {
    loading,
    loadProcess,
    loadLatestSnapshot,
  }
})
