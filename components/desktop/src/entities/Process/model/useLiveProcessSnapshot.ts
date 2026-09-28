import { onMounted, ref, type Ref } from 'vue'
import { useLiveReload, type ChainTableRef } from 'src/shared/lib/realtime'
import type { IProcessGetInput, IProcessSnapshot } from '../types'
import { useProcessStore } from './store'

/**
 * Последний снимок процесса, живой по ленте изменений. Снимок собирается из
 * журнала действий цепи, у журнала своего сигнала нет, — поэтому экран
 * называет таблицы, которые меняет каждый шаг процесса, и снимок
 * перечитывается по их сигналу.
 */
export function useLiveProcessSnapshot(
  input: () => IProcessGetInput,
  tables: ChainTableRef[],
): { loading: Ref<boolean>; snapshot: Ref<IProcessSnapshot | null> } {
  const processStore = useProcessStore()
  const loading = ref(true)
  const snapshot = ref<IProcessSnapshot | null>(null)

  async function load(): Promise<void> {
    try {
      snapshot.value = await processStore.loadLatestSnapshot(input())
    } finally {
      loading.value = false
    }
  }

  onMounted(load)
  useLiveReload(tables, load)
  return { loading, snapshot }
}
