<script setup lang="ts">
/**
 * Топ позиций по обороту — общий раздел «Экономики» кооператива и «Экономики
 * участка». Различаются только источник данных (весь кооператив или один
 * участок) и колонка пункта выдачи, поэтому раздел один на оба стола.
 *
 * Оборот меряется деньгами: сколько имущества принято на склад и на какую
 * сумму, сколько выдано пайщикам и сколько с этого получено целевым членским взносом.
 * Количество остаётся рядом — им проверяют, что за суммой стоит.
 */
import { computed } from 'vue'
import { BaseTable, EmptyState } from 'src/shared/ui/base'
import { MenuSelectButton, WalletCard } from 'src/shared/ui/domain'
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
import { useQueryOverlay } from 'src/shared/lib/navigation'
import { t } from 'src/shared/i18n';

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

const period = computed<string | number>({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', Number(value)),
})

const periodLabel = computed(
  () => TURNOVER_PERIODS.find((p) => p.value === props.modelValue)?.label.toLowerCase() ?? '',
)

/** Подпись под суммой карточки — выбранный период с прописной: «За 30 дней». */
const periodCaption = computed(() => {
  const label = TURNOVER_PERIODS.find((p) => p.value === props.modelValue)?.label ?? ''
  return label ? label[0].toUpperCase() + label.slice(1) : ''
})

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
    { key: 'title', label: t('marketplace.turnoverTop.column.item'), width: '240px' },
  ]
  if (props.showBranch) {
    list.push({ key: 'branch', label: t('marketplace.turnoverTop.column.deliveryPoint'), width: '240px' })
  }
  list.push(
    { key: 'issued', label: t('marketplace.turnoverTop.column.issued'), width: '170px', numeric: true },
    { key: 'fee', label: t('marketplace.turnoverTop.column.fee'), width: '200px', numeric: true },
  )
  return list
})

const offerOverlay = useQueryOverlay('offer')

/** Позиция с предложением открывает его карточку; позиция без предложения — только строка свода. */
function hasOffer(row: TurnoverTableRow): boolean {
  return Boolean(row.offerId)
}

function openOffer(row: TurnoverTableRow): void {
  if (row.offerId) offerOverlay.open(row.offerId)
}

function money(value: number): string {
  return `${formatAsset2Digits(value.toFixed(4))} ₽`
}

function units(value: number, row: TurnoverRow): string {
  return `${value} ${marketplaceOrderUnitLabel(row.unitOfMeasure)}`
}

/**
 * Итоги оборота — карточками сумм, как кошельки на «Экономике участка»:
 * значок, название, пояснение и сумма справа. Оборот считается по выдаче
 * пайщикам, приём на склад не показывается (слово владельца 08.11.2026).
 */
const totals = computed(() => [
  { key: 'issued', icon: 'local_shipping', title: t('marketplace.turnoverTop.totalIssuedLabel'), subtitle: t('marketplace.turnoverTop.totalIssuedSub'), amount: turnover.value.totals.issuedAmount },
  { key: 'fee', icon: 'savings', title: t('marketplace.turnoverTop.totalFeeLabel'), subtitle: t('marketplace.turnoverTop.totalFeeSub'), amount: turnover.value.totals.feeAmount },
])
</script>

<template lang="pug">
//- Заголовок раздела и выбор периода — одной строкой; как считается оборот —
//- подсказкой у заголовка, итоги — плитками чисел, общими для всех столов.
//- Строка открывает карточку предложения справа (`?offer=<id>`): панель
//- `OfferRegistryOverlay` ставит страница, у которой есть право на карточку.
section.turnover
  .turnover__head
    .turnover__title
      .t-h3 {{ $t('marketplace.turnoverTop.title') }}
      q-icon.turnover__hint(name='help_outline' size='18px')
        q-tooltip(max-width='360px')
          | {{ $t('marketplace.turnoverTop.descriptionPart1') }}
          | {{ $t('marketplace.turnoverTop.descriptionPart2', { period: periodLabel }) }}
          | {{ $t('marketplace.turnoverTop.descriptionPart3') }}
    MenuSelectButton(v-model='period' :options='TURNOVER_PERIODS' icon='date_range')

  .row.q-col-gutter-md
    .col-12.col-md-6(v-for='c in totals' :key='c.key')
      WalletCard(
        program='wallet'
        stacked
        :icon='c.icon'
        :title='c.title'
        :subtitle='c.subtitle'
        :balance='c.amount.toFixed(2)'
        symbol='RUB'
        :balance-label='periodCaption'
        :loading='loading'
      )

  BaseTable(
    v-if='loading || rows.length',
    :columns='columns',
    :rows='rows',
    row-key='key',
    :loading='loading',
    :min-width='showBranch ? "900px" : "700px"',
    :clickable-rows='hasOffer',
    @row-click='openOffer'
  )
    template(#cell-branch='{ row }')
      .turnover__branch
        span.turnover__branch-name {{ row.branchName }}
        span.turnover__branch-addr(v-if='row.branchAddress') {{ row.branchAddress }}
    template(#cell-issued='{ row }')
      .turnover__amount
        strong {{ money(row.issuedAmount) }}
        span.turnover__units {{ units(row.issuedUnits, row) }}
    template(#cell-fee='{ row }')
      | {{ money(row.feeAmount) }}

  EmptyState(
    v-else,
    :title='$t("marketplace.turnoverTop.emptyTitle")',
    :body='$t("marketplace.turnoverTop.emptyBody")'
  )
    template(#icon)
      q-icon(name='leaderboard', size='48px')
</template>

<style scoped lang="scss">
.turnover {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--p-3, 12px);
  }

  &__title {
    display: flex;
    align-items: center;
    gap: var(--p-2);
  }

  &__hint {
    color: var(--p-ink-3);
    cursor: help;
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
