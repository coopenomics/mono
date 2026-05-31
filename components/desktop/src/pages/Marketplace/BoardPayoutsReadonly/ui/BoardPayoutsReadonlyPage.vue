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
import { BaseBadge, BaseButton, BaseInput, EmptyState } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
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

function statusVariant(v: string): BaseBadgeVariant {
  switch (v) {
    case 'COMPLETED':
      return 'pos';
    case 'DECLINED':
      return 'neg';
    case 'PENDING':
      return 'warn';
    default:
      return 'neutral';
  }
}

const statusOptions = Object.entries(PAYMENT_STATUS_LABEL).map(([value, label]) => ({
  label,
  value,
}));

function toggleStatus(value: string): void {
  statusFilter.value = statusFilter.value.includes(value)
    ? statusFilter.value.filter((s) => s !== value)
    : [...statusFilter.value, value];
}

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
q-page.board-payouts(role="region", aria-label="Выплаты поставщикам — совет")
  PageHint(storage-key="mp:board-payouts:banner-dismissed")
    | Лента выплат поставщикам по всему кооперативу. Подтверждение и отказ выплат выполняет кассир кооператива — для совета это обзор только для чтения.

  .board-payouts__filters
    BaseInput.board-payouts__supplier(
      v-model="supplierFilter",
      label="Поставщик (account)",
      placeholder="Пусто — все поставщики кооператива",
      clearable,
      @keyup.enter="load"
    )
    BaseButton(variant="primary", :loading="loading", @click="load")
      template(#icon-left)
        q-icon(name="search", size="18px")
      | Применить

  .board-payouts__chips(role="group", aria-label="Фильтр по статусу")
    .chip(
      v-for="opt in statusOptions",
      :key="opt.value",
      :class="statusFilter.includes(opt.value) ? 'chip--accent' : 'chip--neutral'",
      role="button",
      tabindex="0",
      @click="toggleStatus(opt.value)",
      @keydown.enter="toggleStatus(opt.value)"
    ) {{ opt.label }}

  .board-payouts__stats(v-if="items.length")
    .kpi(v-for="(count, status) in totals", :key="status")
      .kpi__head
        span.kpi__eyebrow {{ statusLabel(status) }}
      .kpi__val {{ count }}

  q-table.board-payouts__table(
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
        BaseBadge(:variant="statusVariant(props.row.status)") {{ statusLabel(props.row.status) }}
    template(#no-data)
      .board-payouts__nodata
        EmptyState(
          title="Выплат нет",
          body="Выплат по выбранным фильтрам не найдено."
        )
          template(#icon)
            q-icon(name="payments", size="48px")
</template>

<style scoped lang="scss">
.board-payouts {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  // #no-data слот q-table выравнивает контент влево — центрируем EmptyState.
  &__nodata {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  &__filters {
    display: flex;
    gap: var(--p-3, 12px);
    align-items: flex-end;
    flex-wrap: wrap;
  }

  &__supplier {
    flex: 1 1 320px;
    min-width: 240px;
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

  &__stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--p-3, 12px);
  }
}

@media (max-width: 768px) {
  .board-payouts {
    padding: var(--p-4, 16px);
  }
}
</style>
