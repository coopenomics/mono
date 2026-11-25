<template lang="pug">
//- Содержание процесса, загруженное по хэшу: о чём процесс словами предметной
//- области. Ставят его те места, где процесс ещё не назван, — реестр
//- процессов и правая панель операции. Страница сущности (заказ) показывает
//- свою шапку и эту карточку не ставит.
ProcessContentCard(v-if='content', :coopname='coopname', :content='content')
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { Ledger2Contract, SovietContract } from 'cooptypes'
import { liveTable, useLiveReload } from 'src/shared/lib/realtime'
import { FailAlert } from 'src/shared/api'
import type { RegistrySource } from 'src/shared/lib/registry-source'
import { useProcessStore, type IProcessContent } from 'src/entities/Process'
import ProcessContentCard from './ProcessContentCard.vue'

const props = defineProps<{
  coopname: string
  processHash: string
  processType: string
  /** Чей запрос: стол бухгалтера либо общий реестр процессов. */
  source?: RegistrySource
}>()

const processStore = useProcessStore()
const content = ref<IProcessContent | null>(null)

async function load(): Promise<void> {
  const hash = props.processHash
  try {
    const described = await processStore.loadProcessContent(
      { coopname: props.coopname, hash, process_type: props.processType },
      props.source,
    )
    // Пока ответ шёл, могли открыть другой процесс.
    if (hash === props.processHash) content.value = described
  } catch (e) {
    FailAlert(e)
  }
}

onMounted(load)
watch(() => props.processHash, () => {
  content.value = null
  void load()
})

// Состояние сущности процесса меняют операции учёта и решения совета.
useLiveReload(
  [
    liveTable(Ledger2Contract, Ledger2Contract.Tables.Wallets),
    liveTable(SovietContract, SovietContract.Tables.Decisions),
  ],
  load,
)
</script>
