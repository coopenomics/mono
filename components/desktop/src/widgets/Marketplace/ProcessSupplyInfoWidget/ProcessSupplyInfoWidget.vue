<template lang="pug">
.process-supply-info
  Loader(v-if='loading', text='Загрузка содержания заказа…')
  div(v-else-if='snapshot')
    .row.q-col-gutter-md
      .col-12.col-sm-6
        .text-caption.text-grey-7 Тип процесса
        .text-body2.text-weight-medium Поставка имущества кооперативу
      .col-12.col-sm-6
        .text-caption.text-grey-7 Кооперативный участок (КУ)
        .text-body2 {{ field('braname') || '—' }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 Заказчик
        .text-body2.font-monospace {{ field('orderer') || field('orderer_account') || '—' }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 Поставщик
        .text-body2.font-monospace {{ field('offerer') || field('offerer_account') || '—' }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 Состояние заказа
        .text-body2 {{ statusLabel }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 Единиц в заказе
        .text-body2 {{ field('units_total') || field('units') || '—' }}
    .row.q-mt-md
      q-btn(
        flat
        no-caps
        color='primary'
        icon='fa-solid fa-up-right-from-square'
        label='Открыть заказ на столе ПВЗ'
        :to='deepLink'
      )
  div(v-else)
    .text-caption.text-grey-7 Содержание заказа ещё не доступно.
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useProcessStore, type IProcessSnapshot } from 'src/entities/Process'
import { Loader } from 'src/shared/ui/Loader'
import { orderStatusDisplay } from 'src/widgets/Marketplace/OrderCard'

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

const statusLabel = computed(() => {
  const raw = field('status')
  return orderStatusDisplay(raw).label || raw || '—'
})

const deepLink = computed(() => ({
  name: 'marketplace-pvz-issuance',
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
