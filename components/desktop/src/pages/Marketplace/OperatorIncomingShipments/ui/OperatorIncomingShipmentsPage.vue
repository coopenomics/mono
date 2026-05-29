<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { QTableProps } from 'quasar'
import { FailAlert } from 'src/shared/api'
import { Zeus } from '@coopenomics/sdk'
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits'
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch'
import { BaseBadge, BaseButton, EmptyState } from 'src/shared/ui/base'
import type { BaseBadgeVariant } from 'src/shared/ui/base'
import { listShipmentsByBraname, type MarketplaceShipmentView } from '../api'

type ShipmentStatus = MarketplaceShipmentView['status']

// Активный КУ оператора — из общего контекста стола (без ввода кода вручную).
const route = useRoute()
const store = useOperatorBranchStore()
const coopname = computed(() => String(route.params.coopname ?? ''))
const braname = computed(() => store.activeBraname ?? '')
const statusFilter = ref<ShipmentStatus[]>([])
const items = ref<MarketplaceShipmentView[]>([])
const loading = ref(false)

// «Ожидаемые» — партии, которые ещё не приняты кооперативом: подготовлены
// поставщиком (в пути) или уже на стадии приёмки.
const EXPECTED_STATUSES: ShipmentStatus[] = [
  Zeus.MarketplaceShipmentStatus.SUPPLY_PREPARED,
  Zeus.MarketplaceShipmentStatus.RECEPTION_IN_PROGRESS,
]

const statusOptions: { label: string; value: ShipmentStatus }[] = [
  { label: 'Готовится поставщиком', value: Zeus.MarketplaceShipmentStatus.DRAFT },
  { label: 'Готова к приёмке', value: Zeus.MarketplaceShipmentStatus.SUPPLY_PREPARED },
  { label: 'Идёт приёмка', value: Zeus.MarketplaceShipmentStatus.RECEPTION_IN_PROGRESS },
  { label: 'Принята кооперативом', value: Zeus.MarketplaceShipmentStatus.ACCEPTED_TO_COOP },
  { label: 'Отменена', value: Zeus.MarketplaceShipmentStatus.CANCELLED },
]

function isStatusActive(value: ShipmentStatus): boolean {
  return statusFilter.value.includes(value)
}

function toggleStatus(value: ShipmentStatus): void {
  statusFilter.value = isStatusActive(value)
    ? statusFilter.value.filter((s) => s !== value)
    : [...statusFilter.value, value]
}

const DELIVERY_LABEL: Record<string, string> = {
  A: 'Поставщик лично',
  B: 'Экспедитор по ТТН',
}

const columns: QTableProps['columns'] = [
  { name: 'id', label: 'Партия', field: (r) => String(r.id).slice(0, 8), align: 'left', sortable: true },
  { name: 'offerer', label: 'Поставщик', field: 'offerer_account', align: 'left', sortable: true },
  { name: 'delivery', label: 'Доставка', field: (r) => DELIVERY_LABEL[r.delivery_variant] ?? r.delivery_variant, align: 'left', sortable: true },
  { name: 'amount', label: 'Сумма', field: 'total_amount', align: 'right', sortable: true },
  { name: 'status', label: 'Состояние', field: 'status', align: 'left', sortable: true },
  { name: 'created_at', label: 'Сформирована', field: 'created_at', align: 'left', sortable: true },
]

const filteredRows = computed(() => {
  if (!statusFilter.value.length) return items.value
  return items.value.filter((row) => statusFilter.value.includes(row.status))
})

const summary = computed(() => {
  const byStatus: Record<string, number> = {}
  for (const row of items.value) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1
  }
  const expected = EXPECTED_STATUSES.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0)
  return { byStatus, expected }
})

async function load(): Promise<void> {
  const name = braname.value?.trim()
  if (!name) {
    items.value = []
    return
  }
  loading.value = true
  try {
    items.value = await listShipmentsByBraname({ braname: name })
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить ожидаемые поставки')
  } finally {
    loading.value = false
  }
}

watch(braname, () => void load())

onMounted(async () => {
  await store.ensureLoaded(coopname.value)
  void load()
})

function humanStatus(status: string): string {
  return statusOptions.find((o) => o.value === status)?.label ?? status
}

function statusVariant(status: string): BaseBadgeVariant {
  switch (status) {
    case Zeus.MarketplaceShipmentStatus.SUPPLY_PREPARED:
      return 'info'
    case Zeus.MarketplaceShipmentStatus.RECEPTION_IN_PROGRESS:
      return 'warn'
    case Zeus.MarketplaceShipmentStatus.ACCEPTED_TO_COOP:
      return 'pos'
    case Zeus.MarketplaceShipmentStatus.CANCELLED:
      return 'neg'
    default:
      return 'neutral'
  }
}

function formatAmount(value: unknown): string {
  if (value === null || value === undefined) return '—'
  return formatAsset2Digits(String(value))
}

function formatDateTime(value: unknown): string {
  if (value === null || value === undefined) return '—'
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString('ru-RU')
}
</script>

<template lang="pug">
q-page.shipments(role='region', aria-label='Ожидаемые поставки')
  OperatorBranchBar

  EmptyState(
    v-if='!store.loading && !store.isOperator',
    title='Вы не оператор кооперативного участка',
    body='Ожидаемые поставки доступны председателю участка и его доверенным лицам.'
  )
    template(#icon)
      q-icon(name='storefront', size='48px')

  template(v-else)
    .shipments__head
      .t-h2 Ожидаемые поставки
      .t-muted
        | Партии поставщиков, направленные на ваш пункт выдачи. Дождитесь состояния
        | «Готова к приёмке» — и открывайте акт на столе «Приёмка партии».

    .shipments__filters
      .shipments__chips
        .chip(
          v-for='opt in statusOptions',
          :key='opt.value',
          :class='isStatusActive(opt.value) ? "chip--accent" : "chip--neutral"',
          role='button',
          tabindex='0',
          @click='toggleStatus(opt.value)',
          @keydown.enter='toggleStatus(opt.value)'
        ) {{ opt.label }}
      BaseButton.shipments__refresh(
        variant='ghost',
        icon-only,
        aria-label='Обновить',
        :loading='loading',
        @click='load'
      )
        template(#icon-left)
          q-icon(name='refresh', size='20px')

    .shipments__stats(v-if='items.length')
      .kpi.kpi--accent
        .kpi__head
          span.kpi__eyebrow Ожидают приёмки
        .kpi__val {{ summary.expected }}
      .kpi(v-for='(count, status) in summary.byStatus', :key='status')
        .kpi__head
          span.kpi__eyebrow {{ humanStatus(status) }}
        .kpi__val {{ count }}

    q-table.shipments__table(
      :rows='filteredRows',
      :columns='columns',
      row-key='id',
      :loading='loading',
      :pagination='{ rowsPerPage: 25, sortBy: "created_at", descending: true }',
      :rows-per-page-options='[25, 50, 100, 0]',
      flat,
      bordered,
      binary-state-sort
    )
      template(#body-cell-status='props')
        q-td(:props='props')
          BaseBadge(:variant='statusVariant(props.row.status)') {{ humanStatus(props.row.status) }}

      template(#body-cell-amount='props')
        q-td(:props='props') {{ formatAmount(props.row.total_amount) }}

      template(#body-cell-created_at='props')
        q-td(:props='props') {{ formatDateTime(props.row.created_at) }}

      template(#no-data)
        EmptyState(
          title='Ожидаемых поставок нет',
          body='Партии поставщиков, направленные на ваш участок, появятся здесь. Проверьте фильтры состояния.'
        )
          template(#icon)
            q-icon(name='local_shipping', size='48px')
</template>

<style scoped lang="scss">
.shipments {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__head {
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
  }

  &__filters {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--p-2, 8px);

    .chip {
      cursor: pointer;
      user-select: none;
      height: 28px;
      padding: 0 12px;
    }
  }

  &__refresh {
    margin-left: auto;
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--p-3, 12px);
  }
}

@media (max-width: 768px) {
  .shipments {
    padding: var(--p-4, 16px);

    &__refresh {
      margin-left: 0;
    }
  }
}
</style>
