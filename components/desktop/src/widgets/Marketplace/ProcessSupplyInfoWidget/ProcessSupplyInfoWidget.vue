<template lang="pug">
.process-supply-info
  div(v-if='loading')
    q-spinner(size='sm')
    span.q-ml-sm.text-grey-7 Загрузка содержания заказа…
  div(v-else-if='snapshot')
    .row.q-col-gutter-md
      .col-12.col-sm-6
        .text-caption.text-grey-7 Тип процесса
        .text-body2.text-weight-medium Поставка имущества кооперативу
      .col-12.col-sm-6
        .text-caption.text-grey-7 Кооперативный участок (КУ)
        .text-body2 {{ stringField('braname') || '—' }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 Заказчик
        .text-body2.font-monospace {{ stringField('orderer') || stringField('orderer_account') || '—' }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 Поставщик
        .text-body2.font-monospace {{ stringField('offerer') || stringField('offerer_account') || '—' }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 Состояние заказа
        .text-body2 {{ stringField('status') || '—' }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 Единиц в заказе
        .text-body2 {{ stringField('units_total') || stringField('units') || '—' }}
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
    .text-caption.text-grey-7 Содержание заказа ещё не доступно — синхронизация не завершилась.
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { Queries } from '@coopenomics/sdk'
import { client } from 'src/shared/api/client'

interface Props {
  processHash: string
  processType: string
  coopname: string
}
const props = defineProps<Props>()

const loading = ref(true)
const snapshot = ref<Record<string, unknown> | null>(null)

function stringField(name: string): string | null {
  const v = snapshot.value?.[name]
  return typeof v === 'string' ? v : v != null ? String(v) : null
}

const deepLink = computed(() => ({
  name: 'marketplace-pvz-issuance',
  params: { coopname: props.coopname },
  query: { process_hash: props.processHash },
}))

onMounted(async () => {
  try {
    const result = await client.Query(Queries.Processes.GetProcess.query, {
      variables: { coopname: props.coopname, hash: props.processHash },
    })
    const process = (result as Record<string, unknown>)[Queries.Processes.GetProcess.name] as
      | { delta_history?: Array<{ value?: unknown }> }
      | undefined
    const deltas = process?.delta_history ?? []
    const last = deltas.length ? deltas[deltas.length - 1] : null
    snapshot.value = (last?.value as Record<string, unknown>) ?? null
  } catch {
    snapshot.value = null
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
