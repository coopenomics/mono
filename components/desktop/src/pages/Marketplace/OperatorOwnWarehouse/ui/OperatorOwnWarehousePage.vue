<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { QTableProps } from 'quasar'
import { FailAlert } from 'src/shared/api'
import { Zeus } from '@coopenomics/sdk'
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch'
import { BaseBadge, BaseButton, BaseInput, EmptyState } from 'src/shared/ui/base'
import type { BaseBadgeVariant } from 'src/shared/ui/base'
import { listInventory, type MarketplaceInventoryItemView } from '../api'

// Активный КУ оператора — из общего контекста стола (без ввода кода вручную).
const route = useRoute()
const store = useOperatorBranchStore()
const coopname = computed(() => String(route.params.coopname ?? ''))
const braname = computed(() => store.activeBraname ?? '')

type InventoryStatus = MarketplaceInventoryItemView['status']

const statusFilter = ref<InventoryStatus[]>([])
const ordererFilter = ref<string>('')
const items = ref<MarketplaceInventoryItemView[]>([])
const loading = ref(false)

const statusOptions: { label: string; value: InventoryStatus }[] = [
  { label: 'На складе', value: Zeus.MarketplaceInventoryStatus.LABELED },
  { label: 'Выдано пайщику', value: Zeus.MarketplaceInventoryStatus.ISSUED },
  { label: 'Возврат на склад', value: Zeus.MarketplaceInventoryStatus.RETURNED },
  { label: 'Списано', value: Zeus.MarketplaceInventoryStatus.WRITTEN_OFF },
]

function isStatusActive(value: InventoryStatus): boolean {
  return statusFilter.value.includes(value)
}

function toggleStatus(value: InventoryStatus): void {
  statusFilter.value = isStatusActive(value)
    ? statusFilter.value.filter((s) => s !== value)
    : [...statusFilter.value, value]
}

const columns: QTableProps['columns'] = [
  { name: 'barcode_value', label: 'Штрих-код', field: 'barcode_value', align: 'left', sortable: true },
  { name: 'product', label: 'Товар', field: 'product_name_snapshot', align: 'left', sortable: true },
  { name: 'orderer', label: 'Заказчик', field: 'orderer_account_snapshot', align: 'left', sortable: true },
  { name: 'quantity', label: 'Ед.', field: 'quantity_per_label', align: 'right', sortable: true },
  { name: 'status', label: 'Состояние', field: 'status', align: 'left', sortable: true },
  { name: 'age', label: 'Возраст', field: 'labeled_at', align: 'right' },
  { name: 'labeled_at', label: 'Промаркировано', field: 'labeled_at', align: 'left', sortable: true },
]

const filteredRows = computed(() => {
  const orderer = ordererFilter.value.trim().toLowerCase()
  return items.value.filter((row) => {
    if (statusFilter.value.length && !statusFilter.value.includes(row.status)) return false
    if (orderer && !row.orderer_account_snapshot.toLowerCase().includes(orderer)) return false
    return true
  })
})

const summary = computed(() => {
  const byStatus: Record<string, number> = {}
  for (const row of items.value) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1
  }
  return {
    byStatus,
    totalActive:
      (byStatus[Zeus.MarketplaceInventoryStatus.LABELED] ?? 0) +
      (byStatus[Zeus.MarketplaceInventoryStatus.ISSUED] ?? 0) +
      (byStatus[Zeus.MarketplaceInventoryStatus.RETURNED] ?? 0),
  }
})

async function load(): Promise<void> {
  if (!braname.value.trim()) {
    items.value = []
    return
  }
  loading.value = true
  try {
    items.value = await listInventory({ braname: braname.value.trim() })
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить склад участка')
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
  switch (status) {
    case Zeus.MarketplaceInventoryStatus.LABELED:
      return 'На складе'
    case Zeus.MarketplaceInventoryStatus.ISSUED:
      return 'Выдано пайщику'
    case Zeus.MarketplaceInventoryStatus.RETURNED:
      return 'Возврат на склад'
    case Zeus.MarketplaceInventoryStatus.WRITTEN_OFF:
      return 'Списано'
    default:
      return status
  }
}

function statusVariant(status: string): BaseBadgeVariant {
  switch (status) {
    case Zeus.MarketplaceInventoryStatus.LABELED:
      return 'info'
    case Zeus.MarketplaceInventoryStatus.ISSUED:
      return 'pos'
    case Zeus.MarketplaceInventoryStatus.RETURNED:
      return 'warn'
    case Zeus.MarketplaceInventoryStatus.WRITTEN_OFF:
      return 'neg'
    default:
      return 'neutral'
  }
}

function formatAge(value: unknown): string {
  if (value === null || value === undefined) return '—'
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return '—'
  const days = Math.floor((Date.now() - parsed.getTime()) / 86_400_000)
  if (days <= 0) return 'сегодня'
  if (days === 1) return '1 день'
  if (days < 5) return `${days} дня`
  return `${days} дней`
}

function formatDateTime(value: unknown): string {
  if (value === null || value === undefined) return '—'
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString('ru-RU')
}
</script>

<template lang="pug">
q-page.warehouse(role='region', aria-label='Склад участка')
  OperatorBranchBar

  EmptyState(
    v-if='!store.loading && !store.isOperator',
    title='Вы не оператор кооперативного участка',
    body='Склад участка доступен председателю участка и его доверенным лицам.'
  )
    template(#icon)
      q-icon(name='storefront', size='48px')

  template(v-else)
    .warehouse__head
      .t-h2 Склад участка
      .t-muted Промаркированное имущество вашего пункта выдачи — наклейки, заказчики и состояние.

    .warehouse__filters
      .warehouse__chips
        .chip(
          v-for='opt in statusOptions',
          :key='opt.value',
          :class='isStatusActive(opt.value) ? "chip--accent" : "chip--neutral"',
          role='button',
          tabindex='0',
          @click='toggleStatus(opt.value)',
          @keydown.enter='toggleStatus(opt.value)'
        ) {{ opt.label }}
      BaseInput.warehouse__search(
        v-model='ordererFilter',
        type='search',
        placeholder='Поиск по заказчику',
        clearable
      )
      BaseButton(
        variant='ghost',
        icon-only,
        aria-label='Обновить',
        :loading='loading',
        @click='load'
      )
        template(#icon-left)
          q-icon(name='refresh', size='20px')

    .warehouse__stats(v-if='items.length')
      .kpi.kpi--accent
        .kpi__head
          span.kpi__eyebrow Активных наклеек
        .kpi__val {{ summary.totalActive }}
      .kpi(v-for='(count, status) in summary.byStatus', :key='status')
        .kpi__head
          span.kpi__eyebrow {{ humanStatus(status) }}
        .kpi__val {{ count }}

    q-table.warehouse__table(
      :rows='filteredRows',
      :columns='columns',
      row-key='id',
      :loading='loading',
      :pagination='{ rowsPerPage: 25, sortBy: "labeled_at", descending: true }',
      :rows-per-page-options='[25, 50, 100, 0]',
      flat,
      bordered,
      binary-state-sort
    )
      template(#body-cell-status='props')
        q-td(:props='props')
          BaseBadge(:variant='statusVariant(props.row.status)') {{ humanStatus(props.row.status) }}

      template(#body-cell-age='props')
        q-td(:props='props') {{ formatAge(props.row.labeled_at) }}

      template(#body-cell-labeled_at='props')
        q-td(:props='props') {{ formatDateTime(props.row.labeled_at) }}

      template(#no-data)
        EmptyState(
          title='На складе пусто',
          body='Здесь появятся промаркированные наклейки участка. Проверьте фильтры состояния.'
        )
          template(#icon)
            q-icon(name='inventory_2', size='48px')
</template>

<style scoped lang="scss">
.warehouse {
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

  &__search {
    max-width: 280px;
    width: 100%;
    margin-left: auto;
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--p-3, 12px);
  }
}

@media (max-width: 768px) {
  .warehouse {
    padding: var(--p-4, 16px);

    &__search {
      margin-left: 0;
      max-width: none;
    }
  }
}
</style>
