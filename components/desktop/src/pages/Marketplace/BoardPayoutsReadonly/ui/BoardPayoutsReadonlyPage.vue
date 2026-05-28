<script lang="ts" setup>
/**
 * Эпик 5 / Story 5.x: read-only лента выплат поставщикам по всему кооперативу
 * для совета. Backend: marketplaceListOutgoingPayments (Payment:read:all) с
 * опциональными фильтрами по поставщику и статусам. Подтверждение/отказ
 * выплат делает кассир кооператива — здесь только обзор.
 */
import type { QTableProps } from 'quasar';
import { computed, onMounted, ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { listOutgoingPayments, type MarketplaceOutgoingPaymentView } from '../api';

const items = ref<MarketplaceOutgoingPaymentView[]>([]);
const loading = ref(false);
const supplierFilter = ref<string>('');
const statusFilter = ref<string[]>([]);

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Ожидает оплаты',
  COMPLETED: 'Оплачено',
  DECLINED: 'Отклонено',
};

function statusLabel(v: string): string {
  return PAYMENT_STATUS_LABEL[v] ?? v;
}

const statusOptions = Object.entries(PAYMENT_STATUS_LABEL).map(([value, label]) => ({
  label,
  value,
}));

const columns: QTableProps['columns'] = [
  { name: 'created_at', label: 'Дата', field: 'created_at', align: 'left', sortable: true, format: formatDate },
  { name: 'payee', label: 'Поставщик', field: 'payee_account', align: 'left', sortable: true },
  { name: 'amount', label: 'Сумма', field: 'amount', align: 'right', sortable: true, format: (v: string) => formatAsset2Digits(String(v)) },
  { name: 'symbol', label: 'Валюта', field: 'symbol', align: 'center' },
  { name: 'status', label: 'Статус', field: 'status', align: 'left', sortable: true, format: (v: string) => statusLabel(v) },
  { name: 'purpose', label: 'Назначение', field: 'purpose', align: 'left' },
];

const filteredRows = computed(() => {
  if (!statusFilter.value.length) return items.value;
  return items.value.filter((r) => statusFilter.value.includes(r.status));
});

const totals = computed(() => {
  const byStatus: Record<string, number> = {};
  for (const r of items.value) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  }
  return byStatus;
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    const supplier = supplierFilter.value.trim();
    items.value = await listOutgoingPayments(
      supplier ? { supplier_account: supplier } : undefined,
    );
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить ленту выплат');
  } finally {
    loading.value = false;
  }
}

function formatDate(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('ru-RU');
}

onMounted(() => {
  void load();
});
</script>

<template lang="pug">
q-page.mp-role-admin.mp-board-payouts.q-pa-md(role="region", aria-label="Выплаты поставщикам — совет")
  .row.items-center.q-mb-xs
    .text-h5 Выплаты поставщикам — обзор совета
    q-space
    q-btn(flat, no-caps, icon="refresh", label="Обновить", :loading="loading", @click="load")
  .text-caption.text-grey-7.q-mb-md(style="max-width: 720px")
    | Лента выплат поставщикам по всему кооперативу. Подтверждение и отказ выплат выполняет кассир кооператива — для совета это read-only обзор.

  q-card.mp-card.q-mb-md(flat, bordered)
    q-card-section
      .row.q-col-gutter-sm.items-end
        q-input.col-12.col-sm-4(
          v-model="supplierFilter",
          label="Поставщик (account)",
          dense,
          outlined,
          clearable,
          hint="Пусто — все поставщики кооператива",
          @keyup.enter="load"
        )
        q-select.col-12.col-sm-4(
          v-model="statusFilter",
          :options="statusOptions",
          label="Статус выплаты",
          dense,
          outlined,
          multiple,
          emit-value,
          map-options
        )
        q-btn.col-12.col-sm-3(color="primary", label="Применить", :loading="loading", @click="load")

  .row.q-col-gutter-md.q-mb-md(v-if="items.length")
    q-card.mp-card.col-6.col-sm-3(v-for="(count, status) in totals", :key="status")
      q-card-section
        .text-caption.text-grey-7 {{ statusLabel(status) }}
        .text-h6 {{ count }}

  q-table.mp-card(
    :rows="filteredRows",
    :columns="columns",
    row-key="id",
    flat,
    bordered,
    :loading="loading",
    :pagination="{ rowsPerPage: 25, sortBy: 'created_at', descending: true }",
    :rows-per-page-options="[25, 50, 100, 0]",
    binary-state-sort
  )
    template(#body-cell-status="props")
      q-td(:props="props")
        span.mp-status-chip {{ statusLabel(props.row.status) }}
    template(#no-data)
      .full-width.text-center.q-pa-md.text-grey-7 Выплат по выбранным фильтрам нет.
</template>

<style scoped lang="scss">
.mp-board-payouts {
  display: flex;
  flex-direction: column;
  gap: var(--mp-space-md);
}
</style>
