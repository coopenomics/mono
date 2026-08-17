<template lang="pug">
.uv-ndfl(v-if='editsValue')
  .editor-section
    h3.section-title Налог к перечислению

    .uv-ndfl__period
      span.uv-ndfl__period-label Расчётный период
      span.uv-ndfl__period-value {{ periodTitle }}

    .uv-ndfl__hint
      | Сумма посчитана по налогу, удержанному из материальной помощи за этот
      | период. Уведомление подаётся только за периоды с удержаниями — если
      | выплат не было, подавать нечего.

    BaseInput(
      label='Сумма налога, ₽'
      type='number'
      :model-value='editsValue.payment.amount'
      :error='msgFor("payment.amount")'
      @update:model-value='v => update(toInt(v))'
    )

    BaseBanner(v-if='editsValue.payment.amount === 0', variant='info')
      | За этот период удержаний не было. Уведомление с нулевой суммой не
      | подаётся — выберите период, в котором была выплата.
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { BaseInput, BaseBanner } from 'src/shared/ui/base'
import { uvNdflPeriodTitle } from './uv-ndfl-edits'
import type { UvNdflEdits } from './uv-ndfl-edits'

/**
 * Сумма уведомления об исчисленных суммах НДФЛ.
 *
 * Номер расчётного периода сквозной по году (1..24) и человеку ничего не
 * говорит, поэтому рядом показывается расшифровка: месяц и половина месяца.
 * Обычно период выбирается кликом по ячейке календаря, а не руками.
 */

const props = defineProps<{
  edits: UvNdflEdits | null
  /** Ошибки полей: путь → сообщения, как их отдаёт валидация формы. */
  fieldErrors?: Record<string, string[]>
}>()

const emit = defineEmits<{
  (e: 'update:edits', value: UvNdflEdits | null): void
  (e: 'dirty', path: string): void
}>()

const editsValue = computed(() => props.edits)

const periodTitle = computed(() => uvNdflPeriodTitle(props.edits?.header.period))

function msgFor(path: string): string {
  return props.fieldErrors?.[path]?.[0] ?? ''
}

function toInt(value: unknown): number {
  const parsed = Math.round(Number(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function update(amount: number): void {
  if (!props.edits) return
  const next = structuredClone(props.edits)
  next.payment.amount = amount
  emit('update:edits', next)
  emit('dirty', 'payment.amount')
}
</script>

<style scoped lang="scss">
.uv-ndfl {
  &__period {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--p-2, 8px);
    margin-bottom: var(--p-2, 8px);
  }

  &__period-label {
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm, 13px);
  }

  &__period-value {
    color: var(--p-ink);
    font-weight: 600;
  }

  &__hint {
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm, 13px);
    line-height: var(--p-lh-body-sm, 1.5);
    margin-bottom: var(--p-3, 12px);
  }
}
</style>
