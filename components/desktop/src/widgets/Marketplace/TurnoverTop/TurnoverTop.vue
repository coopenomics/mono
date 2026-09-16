<script setup lang="ts">
/**
 * Топ позиций по обороту — общий раздел «Экономики» кооператива и «Экономики
 * участка». Различаются только источник данных (весь кооператив или один
 * участок) и колонка пункта выдачи, поэтому раздел один на оба стола.
 *
 * Оборот меряется деньгами: сколько имущества принято на склад и на какую
 * сумму, сколько выдано пайщикам и сколько на этом заработано наценкой.
 * Количество остаётся рядом — им проверяют, что за суммой стоит.
 */
import { computed } from 'vue'
import { BaseSelect, BaseTable, EmptyState } from 'src/shared/ui/base'
import type { BaseTableColumn } from 'src/shared/ui/base'
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits'
import { marketplaceOrderUnitLabel } from 'src/shared/lib/consts/marketplace-units'
import {
  TURNOVER_PERIODS,
  buildTurnover,
  turnoverSince,
  type TurnoverInventoryItem,
  type TurnoverOrder,
  type TurnoverRow,
} from 'src/shared/lib/marketplace'

const TOP_LIMIT = 10

const props = withDefaults(
  defineProps<{
    /** Период в днях; 0 — за всё время. */
    modelValue: number
    inventory: TurnoverInventoryItem[]
    orders: TurnoverOrder[]
    loading?: boolean
    /** Показывать колонку пункта выдачи — на столе участка он один. */
    showBranch?: boolean
  }>(),
  { loading: false, showBranch: true },
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const period = computed<number>({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const periodLabel = computed(
  () => TURNOVER_PERIODS.find((p) => p.value === props.modelValue)?.label.toLowerCase() ?? '',
)

const turnover = computed(() =>
  buildTurnover(props.inventory, props.orders, turnoverSince(props.modelValue)),
)

const rows = computed(() =>
  turnover.value.rows.slice(0, TOP_LIMIT).map((row, i) => ({ ...row, rank: i + 1 })),
)

type TurnoverTableRow = TurnoverRow & { rank: number }

const columns = computed<BaseTableColumn<TurnoverTableRow>[]>(() => {
  const list: BaseTableColumn<TurnoverTableRow>[] = [
    { key: 'rank', label: '№', width: '56px', numeric: true },
    { key: 'title', label: 'Позиция', width: '240px' },
  ]
  if (props.showBranch) {
    list.push({ key: 'branch', label: 'Пункт выдачи', width: '240px' })
  }
  list.push(
    { key: 'accepted', label: 'Принято', width: '170px', numeric: true },
    { key: 'issued', label: 'Выдано', width: '170px', numeric: true },
    { key: 'fee', label: 'Наценка', width: '140px', numeric: true },
  )
  return list
})

function money(value: number): string {
  return `${formatAsset2Digits(value.toFixed(4))} ₽`
}

function units(value: number, row: TurnoverRow): string {
  return `${value} ${marketplaceOrderUnitLabel(row.unitOfMeasure)}`
}

const totals = computed(() => [
  {
    key: 'accepted',
    label: 'Принято на склад',
    value: money(turnover.value.totals.acceptedAmount),
  },
  { key: 'issued', label: 'Выдано пайщикам', value: money(turnover.value.totals.issuedAmount) },
  { key: 'fee', label: 'Наценка с выданного', value: money(turnover.value.totals.feeAmount) },
])
</script>

<template lang="pug">
section.turnover
  .turnover__head
    .t-h3 Топ позиций по обороту
    BaseSelect.turnover__period(v-model='period', :options='TURNOVER_PERIODS', label='Период')

  .turnover__note
    | Приход считается по дате приёмки имущества кооперативом, выдача — по дате
    | получения заказчиком {{ periodLabel }}. Наценка — доход кооператива с
    | выданного за тот же срок.

  .turnover__totals
    .turnover__total(v-for='t in totals', :key='t.key')
      .turnover__total-label {{ t.label }}
      .turnover__total-value {{ t.value }}

  BaseTable(
    v-if='loading || rows.length',
    :columns='columns',
    :rows='rows',
    row-key='key',
    :loading='loading',
    :min-width='showBranch ? "900px" : "700px"'
  )
    template(#cell-branch='{ row }')
      .turnover__branch
        span.turnover__branch-name {{ row.branchName }}
        span.turnover__branch-addr(v-if='row.branchAddress') {{ row.branchAddress }}
    template(#cell-accepted='{ row }')
      .turnover__amount
        strong {{ money(row.acceptedAmount) }}
        span.turnover__units {{ units(row.acceptedUnits, row) }}
    template(#cell-issued='{ row }')
      .turnover__amount
        strong {{ money(row.issuedAmount) }}
        span.turnover__units {{ units(row.issuedUnits, row) }}
    template(#cell-fee='{ row }')
      | {{ money(row.feeAmount) }}

  EmptyState(
    v-else,
    title='Оборота за период нет',
    body='Здесь появится рейтинг позиций по суммам прихода и выдачи. Выберите период подлиннее, если приёмок и выдач давно не было.'
  )
    template(#icon)
      q-icon(name='leaderboard', size='48px')
</template>

<style scoped lang="scss">
.turnover {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--p-3, 12px);
  }

  &__period {
    width: 200px;
  }

  &__note {
    color: var(--p-ink-3);
    font-size: var(--p-fs-body-sm, 13px);
    line-height: var(--p-lh-body-sm, 1.5);
  }

  &__totals {
    display: flex;
    flex-wrap: wrap;
    gap: var(--p-3, 12px);
  }

  &__total {
    flex: 1 1 200px;
    min-width: 180px;
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    background: var(--p-surface);
    padding: var(--p-3, 12px) var(--p-4, 16px);
  }

  &__total-label {
    color: var(--p-ink-3);
    font-size: var(--p-fs-meta, 12px);
  }

  &__total-value {
    margin-top: var(--p-1, 4px);
    color: var(--p-ink);
    font-size: var(--p-fs-h2, 20px);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  &__branch {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__branch-name {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  &__branch-addr {
    color: var(--p-ink-3);
    font-size: var(--p-fs-body-sm, 13px);
    overflow-wrap: anywhere;
  }

  &__amount {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  &__units {
    color: var(--p-ink-3);
    font-size: var(--p-fs-meta, 12px);
  }
}
</style>
