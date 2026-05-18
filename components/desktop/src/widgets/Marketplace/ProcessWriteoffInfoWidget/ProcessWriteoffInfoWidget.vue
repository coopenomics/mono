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
        .text-body2 {{ stringField('status') || '—' }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 Расчётный цикл начат
        .text-body2 {{ formatDate(stringField('cycle_started_at')) }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 Итоговая сумма
        .text-body2.font-monospace {{ stringField('total_amount') || '—' }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 Решение совета
        .text-body2 {{ stringField('decision_id') || 'не зарегистрировано' }}
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
    .text-caption.text-grey-7 Содержание проекта ещё не доступно — синхронизация не завершилась.
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

const triggerLabel = computed(() => {
  const v = stringField('trigger')
  if (v === 'cron') return 'Автоматический (ежемесячный крон)'
  if (v === 'manual') return 'Ручной (по инициативе председателя)'
  return '—'
})

function formatDate(value: string | null): string {
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
