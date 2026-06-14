<template lang="pug">
.process-writeoff-info
  div(v-if='loading')
    q-spinner(size='sm')
    span.q-ml-sm.text-grey-7 Загрузка проекта решения…
  div(v-else-if='snapshot')
    .row.q-col-gutter-md
      .col-12.col-sm-6
        .text-caption.text-grey-7 Тип процесса
        .text-body2.text-weight-medium Списание скоропорта
      .col-12.col-sm-6
        .text-caption.text-grey-7 Источник проекта
        .text-body2 {{ triggerLabel }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 Состояние решения
        .text-body2 {{ statusLabel }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 Расчётный цикл начат
        .text-body2 {{ formatDate(field('cycle_started_at')) }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 Итоговая сумма
        .text-body2.font-monospace {{ field('total_amount') ? formatAsset2Digits(field('total_amount')) : '—' }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 Решение совета
        .text-body2 {{ field('decision_id') || 'не зарегистрировано' }}
    .row.q-mt-md
      q-btn(
        flat
        no-caps
        color='primary'
        icon='fa-solid fa-up-right-from-square'
        label='Открыть проект на столе списания скоропорта'
        :to='deepLink'
      )
  div(v-else)
    .text-caption.text-grey-7 Содержание проекта ещё не доступно.
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useProcessStore, type IProcessSnapshot } from 'src/entities/Process'
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits'

interface Props {
  processHash: string
  processType: string
  coopname: string
}
const props = defineProps<Props>()

const processStore = useProcessStore()
const loading = ref(true)
const snapshot = ref<IProcessSnapshot | null>(null)

function field(name: string): string {
  const v = snapshot.value?.[name]
  return typeof v === 'string' ? v : v != null ? String(v) : ''
}

const triggerLabel = computed(() => {
  const v = field('trigger')
  if (v === 'cron') return 'Автоматический (ежемесячный)'
  if (v === 'manual') return 'Ручной (по инициативе председателя)'
  return '—'
})

// Подписи статусов проекта списания — согласованы с админ-столом
// (AdminWriteoffs) и столом ПВЗ (PvzWriteoffs).
const WRITEOFF_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Черновик',
  PROPOSED: 'На повестке совета',
  ON_AGENDA: 'На повестке совета',
  AUTHORIZED: 'Одобрено советом',
  EXECUTING: 'Идёт списание',
  EXECUTED: 'Исполнено',
  REJECTED: 'Отклонено',
  DECLINED: 'Отклонено',
}
const statusLabel = computed(() => {
  const raw = field('status')
  return WRITEOFF_STATUS_LABEL[raw] || raw || '—'
})

function formatDate(value: string): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('ru-RU')
}

const deepLink = computed(() => ({
  name: 'marketplace-writeoffs',
  params: { coopname: props.coopname },
  query: { process_hash: props.processHash },
}))

onMounted(async () => {
  try {
    snapshot.value = await processStore.loadLatestSnapshot({
      coopname: props.coopname,
      hash: props.processHash,
    })
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
.font-monospace {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  letter-spacing: 0.03em;
}
</style>
