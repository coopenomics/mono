<template lang="pug">
.process-return-info
  Loader(v-if='loading', text='Загрузка содержания заявления…')
  div(v-else-if='snapshot')
    .row.q-col-gutter-md
      .col-12.col-sm-6
        .text-caption.text-grey-7 Тип процесса
        .text-body2.text-weight-medium Гарантийный возврат имущества
      .col-12.col-sm-6
        .text-caption.text-grey-7 Кооперативный участок (КУ)
        .text-body2 {{ field('braname') || '—' }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 Заказчик
        .text-body2.font-monospace {{ field('orderer') || field('orderer_account') || '—' }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 Состояние заявления
        .text-body2 {{ statusLabel }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 Исходный заказ
        .text-body2.font-monospace {{ shortHash(field('order_hash') || field('parent_order_hash')) }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 Причина обращения
        .text-body2 {{ field('reason') || '—' }}
    .row.q-mt-md
      q-btn(
        flat
        no-caps
        color='primary'
        icon='fa-solid fa-up-right-from-square'
        label='Открыть заявление на столе ПВЗ'
        :to='deepLink'
      )
  div(v-else)
    .text-caption.text-grey-7 Содержание заявления ещё не доступно.
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useProcessStore, type IProcessSnapshot } from 'src/entities/Process'
import { Loader } from 'src/shared/ui/Loader'

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

function shortHash(v: string): string {
  if (!v) return '—'
  return v.length > 16 ? `${v.slice(0, 8)}…${v.slice(-4)}` : v
}

// Подписи статусов гарантийного возврата — канон ReturnClaimDetailsDialog.
const RETURN_STATUS_LABEL: Record<string, string> = {
  PENDING_CHAIRMAN_REVIEW: 'На рассмотрении оператора',
  APPROVED_FOR_VISIT: 'Приглашение на участок',
  REJECTED_REMOTELY: 'Отказано удалённо',
  REJECTED_AT_VISIT: 'Отказано на месте',
  PENDING_COUNCIL: 'Имущество принято — ждём решение совета',
  ACCEPTED_BY_COUNCIL: 'Совет принял — паевой взнос восстановлен',
  DECLINED_BY_COUNCIL: 'Совет отказал — имущество ждёт пайщика',
  HANDED_BACK: 'Имущество выдано обратно',
}
const statusLabel = computed(() => {
  const raw = field('status')
  return RETURN_STATUS_LABEL[raw] || raw || '—'
})

const deepLink = computed(() => ({
  name: 'marketplace-pvz-returns',
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
