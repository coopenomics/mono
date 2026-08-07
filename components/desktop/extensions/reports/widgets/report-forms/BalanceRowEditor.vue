<template lang="pug">
.balance-row
  .br-label {{ label }}
  .br-code {{ code }}
  .br-input
    q-input(
      type='number'
      :model-value='row?.otch ?? 0'
      @update:model-value='v => emitField("otch", v)'
      dense outlined
      input-class='text-right'
      :error='errFor("otch")'
      :error-message='msgFor("otch")'
    )
  .br-input
    q-input(
      type='number'
      :model-value='row?.prev ?? 0'
      @update:model-value='v => emitField("prev", v)'
      dense outlined
      input-class='text-right'
      :error='errFor("prev")'
      :error-message='msgFor("prev")'
    )
  .br-input
    q-input(
      type='number'
      :model-value='row?.prePrev ?? 0'
      @update:model-value='v => emitField("prePrev", v)'
      dense outlined
      input-class='text-right'
      :error='errFor("prePrev")'
      :error-message='msgFor("prePrev")'
    )
</template>

<script setup lang="ts">
interface BalanceRow {
  otch: number
  prev: number
  prePrev: number
}

const props = defineProps<{
  label: string
  code: string
  row: BalanceRow | null
  /** JSONPath строки без учёта суффикса (например "balance.assetsTotal") — для сопоставления с fieldErrors. */
  basePath?: string
  /** Серверные ошибки валидации всей формы: ключ = JSONPath поля. */
  fieldErrors?: Record<string, string[]>
}>()

const emit = defineEmits<{
  (e: 'update', value: BalanceRow): void
}>()

const MAX_ABS = 999_999_999_999

function clamp(v: unknown): number {
  const n = Number(v ?? 0)
  if (!Number.isFinite(n)) return 0
  return Math.max(-MAX_ABS, Math.min(MAX_ABS, Math.round(n)))
}

function emitField(key: keyof BalanceRow, raw: unknown): void {
  const base: BalanceRow = props.row ?? { otch: 0, prev: 0, prePrev: 0 }
  const next: BalanceRow = { ...base, [key]: clamp(raw) }
  emit('update', next)
}

function pathFor(key: keyof BalanceRow): string {
  return props.basePath ? `${props.basePath}.${key}` : key
}

function errFor(key: keyof BalanceRow): boolean {
  return (props.fieldErrors?.[pathFor(key)]?.length ?? 0) > 0
}

function msgFor(key: keyof BalanceRow): string {
  return props.fieldErrors?.[pathFor(key)]?.[0] ?? ''
}
</script>

<style scoped lang="scss">
.balance-row {
  display: grid;
  grid-template-columns: 1fr 60px repeat(3, 140px);
  gap: 8px;
  padding: 6px 8px;
  border-bottom: 1px solid #eee;
  align-items: center;
  font-size: 13px;
  &:last-child { border-bottom: none; }
}

.br-label { padding-right: 8px; }
.br-code { color: #888; text-align: center; }
.br-input :deep(.q-field__control) { height: 32px; min-height: 32px; }

.balance-row.total {
  background: #fafafa;
  font-weight: 600;
}
</style>
