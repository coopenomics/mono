<template lang="pug">
q-page.mp-role-operator.q-pa-md(role="region", aria-label="Ожидаемые поставки")
  .text-h5.q-mb-xs Ожидаемые поставки
  .text-caption.text-grey-7.q-mb-md(style="max-width: 720px")
    | Партии поставщиков, направленные на ваш кооперативный участок. Дождитесь статуса «Готова к приёмке» — и открывайте акт приёмки на столе «Приёмка партии».

  q-card.mp-card.q-mb-md
    q-card-section
      .row.q-col-gutter-sm.items-end
        q-input.col-12.col-sm-4(
          v-model="braname",
          label="Код кооперативного участка",
          dense,
          outlined,
          clearable,
          hint="Подставлен автоматически по вашему КУ. Измените вручную при необходимости.",
          @keyup.enter="load"
        )
        q-select.col-12.col-sm-4(
          v-model="statusFilter",
          :options="statusOptions",
          label="Состояние партии",
          dense,
          outlined,
          multiple,
          emit-value,
          map-options
        )
        q-btn.col-12.col-sm-3(
          color="primary",
          label="Обновить",
          :loading="loading",
          :disable="!braname",
          @click="load"
        )
      .q-mt-sm(v-if="ownBranches.length > 1")
        span.text-caption.q-mr-sm Ваши участки:
        q-chip(
          v-for="b in ownBranches",
          :key="b",
          clickable,
          dense,
          :color="b === braname ? 'primary' : 'grey-3'",
          :text-color="b === braname ? 'white' : 'dark'",
          :label="b",
          @click="braname = b; load()"
        )

  .row.q-col-gutter-md.q-mb-md(v-if="items.length")
    q-card.mp-card.col-12.col-sm-3
      q-card-section
        .text-caption.text-grey-7 Ожидают приёмки
        .text-h6 {{ summary.expected }}
    q-card.mp-card.col-12.col-sm-3(
      v-for="(count, status) in summary.byStatus",
      :key="status"
    )
      q-card-section
        .text-caption.text-grey-7 {{ humanStatus(status) }}
        .text-h6 {{ count }}

  q-table.mp-card(
    :rows="filteredRows",
    :columns="columns",
    row-key="id",
    :loading="loading",
    :pagination="{ rowsPerPage: 25, sortBy: 'created_at', descending: true }",
    :rows-per-page-options="[25, 50, 100, 0]",
    flat,
    bordered,
    binary-state-sort
  )
    template(#body-cell-status="props")
      q-td(:props="props")
        span.mp-status-chip(:class="statusChipClass(props.row.status)")
          | {{ humanStatus(props.row.status) }}

    template(#body-cell-amount="props")
      q-td(:props="props") {{ formatAmount(props.row.total_amount) }}

    template(#body-cell-created_at="props")
      q-td(:props="props") {{ formatDateTime(props.row.created_at) }}

    template(#no-data)
      .full-width.text-center.q-pa-md.text-grey-7
        | {{ braname ? 'Партий по этому КУ нет — проверьте код или фильтр по состояниям.' : 'Введите код КУ и нажмите «Обновить».' }}
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import type { QTableProps } from 'quasar'
import { FailAlert } from 'src/shared/api'
import { Zeus } from '@coopenomics/sdk'
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits'
import {
  fetchOperatorBranches,
  listShipmentsByBraname,
  type MarketplaceShipmentView,
} from '../api'

type ShipmentStatus = MarketplaceShipmentView['status']

const braname = ref<string>('')
const ownBranches = ref<string[]>([])
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

async function autoDetectBranch(): Promise<void> {
  try {
    const me = await fetchOperatorBranches()
    ownBranches.value = me.branches ?? []
    if (!braname.value?.trim() && ownBranches.value.length > 0) {
      braname.value = ownBranches.value[0]
    }
  } catch {
    // whoAmI недоступен — оставляем ручной ввод braname
  }
}

onMounted(async () => {
  await autoDetectBranch()
  await load()
})

function humanStatus(status: string): string {
  return statusOptions.find((o) => o.value === status)?.label ?? status
}

function statusChipClass(status: string): string {
  switch (status) {
    case Zeus.MarketplaceShipmentStatus.SUPPLY_PREPARED:
      return 'mp-status-chip--info'
    case Zeus.MarketplaceShipmentStatus.RECEPTION_IN_PROGRESS:
      return 'mp-status-chip--warning'
    case Zeus.MarketplaceShipmentStatus.ACCEPTED_TO_COOP:
      return 'mp-status-chip--success'
    case Zeus.MarketplaceShipmentStatus.CANCELLED:
      return 'mp-status-chip--error'
    default:
      return 'mp-status-chip--neutral'
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
