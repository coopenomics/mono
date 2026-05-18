<template lang="pug">
.process-return-info
  div(v-if='loading')
    q-spinner(size='sm')
    span.q-ml-sm.text-grey-7 Загрузка содержания заявления…
  div(v-else-if='snapshot')
    .row.q-col-gutter-md
      .col-12.col-sm-6
        .text-caption.text-grey-7 Тип процесса
        .text-body2.text-weight-medium Гарантийный возврат имущества
      .col-12.col-sm-6
        .text-caption.text-grey-7 Кооперативный участок (КУ)
        .text-body2 {{ stringField('braname') || '—' }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 Заказчик
        .text-body2.font-monospace {{ stringField('orderer') || stringField('orderer_account') || '—' }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 Состояние заявления
        .text-body2 {{ stringField('status') || '—' }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 Исходный заказ
        .text-body2.font-monospace {{ shortHash(stringField('order_hash') || stringField('parent_order_hash')) }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 Причина обращения
        .text-body2 {{ stringField('reason') || '—' }}
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
    .text-caption.text-grey-7 Содержание заявления ещё не доступно — синхронизация не завершилась.
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

function shortHash(v: string | null): string {
  if (!v) return '—'
  return v.length > 16 ? `${v.slice(0, 8)}…${v.slice(-4)}` : v
}

const deepLink = computed(() => ({
  name: 'marketplace-pvz-returns',
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
