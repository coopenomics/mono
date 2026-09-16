<script lang="ts" setup>
/**
 * Эпик 5 / Story 5.x: read-only лента выплат поставщикам по всему кооперативу
 * для совета. Backend: marketplaceListOutgoingPayments (Payment:read:all).
 * Поставщик показывается человеческим именем (ФИО или наименование
 * организации), по нему же идёт поиск. Состояние выплаты — кнопкой фильтра в
 * шапке (канон: действия и отборы страницы живут в топбаре). Строка
 * раскрывает разворот выплаты: за что платили и чем оплата подтверждена.
 * Подтверждение и отказ выплат делает кассир кооператива — здесь только обзор.
 */
import { computed, onMounted, ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import { useFirstLoad } from 'src/shared/lib/composables';
import { useQueryOverlay } from 'src/shared/lib/navigation';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { useHeaderActions } from 'src/shared/hooks';
import { BaseBadge, BaseInput, BaseTable, EmptyState } from 'src/shared/ui/base';
import type { BaseTableColumn } from 'src/shared/ui/base';
import { PageHint, StatusFilterButton } from 'src/shared/ui/domain';
import { listOutgoingPayments, type MarketplaceOutgoingPaymentView } from '../api';
import { PAYOUT_STATUS_FILTERS, statusLabel, statusVariant } from '../lib/payoutStatus';
import PayoutDetailOverlay from './PayoutDetailOverlay.vue';
import RefreshPayoutsButton from './RefreshPayoutsButton.vue';

const { registerAction } = useHeaderActions();
const payoutOverlay = useQueryOverlay('payout');

const items = ref<MarketplaceOutgoingPaymentView[]>([]);
// true до первого запроса: иначе первый кадр показывает «выплат нет» вместо
// каркаса, и первая загрузка неотличима от пустой ленты.
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
// clearable у BaseInput при очистке кладёт null — держим это в типе.
const supplierSearch = ref<string | null>('');
const statusFilter = ref<string[]>([]);

const columns: BaseTableColumn<MarketplaceOutgoingPaymentView>[] = [
  {
    key: 'created_at',
    label: 'Дата',
    field: (row) => formatDate(row.created_at),
    width: '180px',
    nowrap: true,
    sortable: true,
    sort: (_a, _b, rowA, rowB) => compareDates(rowA.created_at, rowB.created_at),
  },
  {
    key: 'payee',
    label: 'Поставщик',
    // ФИО физлица/ИП или наименование организации; логин аккаунта — запасной
    // вариант, если имя в профиле ещё не заполнено.
    field: (row) => row.payee_name ?? row.payee_account,
    sortable: true,
  },
  {
    key: 'amount',
    label: 'Сумма',
    field: (row) => `${formatAsset2Digits(String(row.amount))} ${row.symbol}`,
    numeric: true,
    nowrap: true,
    width: '160px',
    sortable: true,
    sort: (_a, _b, rowA, rowB) =>
      Number.parseFloat(String(rowA.amount)) - Number.parseFloat(String(rowB.amount)),
  },
  { key: 'status', label: 'Статус', width: '160px', sortable: true, field: (row) => row.status },
  { key: 'purpose', label: 'Назначение', field: (row) => row.purpose },
];

const filteredRows = computed(() => {
  const query = (supplierSearch.value ?? '').trim().toLowerCase();
  return items.value.filter((r) => {
    if (statusFilter.value.length && !statusFilter.value.includes(r.status)) return false;
    if (!query) return true;
    // Ищем по человеческому имени получателя — по логину аккаунта совет
    // поставщика не опознаёт.
    return (r.payee_name ?? '').toLowerCase().includes(query);
  });
});

const isEmpty = computed(() => !firstLoad.value && !filteredRows.value.length);

/**
 * Итог по отобранным строкам — подвал таблицы. Без него лента обрывалась
 * последней строкой, и было не видно ни сколько всего выплат, ни на какую
 * сумму. Валюты складываем раздельно: сумма разных символов смысла не имеет.
 */
const totals = computed(() => {
  const bySymbol = new Map<string, number>();
  for (const r of filteredRows.value) {
    const amount = Number.parseFloat(String(r.amount));
    if (!Number.isFinite(amount)) continue;
    bySymbol.set(r.symbol, (bySymbol.get(r.symbol) ?? 0) + amount);
  }
  return {
    count: filteredRows.value.length,
    sums: [...bySymbol].map(([symbol, sum]) => `${formatAsset2Digits(sum.toFixed(4))} ${symbol}`),
  };
});

/** «1 выплата», «2 выплаты», «5 выплат» — число в подвале читается вслух. */
function payoutsCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} выплата`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} выплаты`;
  return `${count} выплат`;
}

function compareDates(a: unknown, b: unknown): number {
  return new Date(String(a)).getTime() - new Date(String(b)).getTime();
}

function formatDate(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('ru-RU');
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = await listOutgoingPayments();
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить ленту выплат');
  } finally {
    loading.value = false;
  }
}

function onStatusFilterUpdate(value: string[]): void {
  statusFilter.value = value;
}

function openPayout(row: MarketplaceOutgoingPaymentView): void {
  payoutOverlay.open(row.id);
}

onMounted(() => {
  // Отбор по состоянию и обновление ленты — в шапке: чипы и кнопка «Обновить»
  // над таблицей занимали строку, прыгали по ширине поля поиска и оставляли
  // ленту без единой линии фильтров.
  registerAction({
    id: 'mp-board-payouts-filter',
    component: StatusFilterButton,
    props: {
      options: PAYOUT_STATUS_FILTERS,
      selected: statusFilter,
      onChange: onStatusFilterUpdate,
    },
    order: 1,
  });
  registerAction({
    id: 'mp-board-payouts-refresh',
    component: RefreshPayoutsButton,
    props: { onClick: () => void load(), loading },
    order: 2,
  });
  void load();
});
</script>

<template lang="pug">
q-page.board-payouts(role="region", aria-label="Выплаты поставщикам")
  PageHint(storage-key="mp:board-payouts:banner-dismissed")
    | Лента выплат поставщикам по всему кооперативу. Подтверждение и отказ выплат выполняет кассир кооператива — для совета это обзор только для чтения. Откройте выплату, чтобы увидеть, за какой заказ платили и чем оплата подтверждена.

  //- Поиск — одним полем, без карточки-обёртки: единственный фильтр в
  //- собственной рамке поверх рамки контейнера читался как чужая врезка.
  BaseInput.board-payouts__search(
    v-model="supplierSearch",
    placeholder="Поиск по ФИО или наименованию организации",
    clearable
  )
    template(#prepend)
      q-icon(name="search", size="18px")

  BaseTable(
    v-if="!isEmpty",
    :columns="columns",
    :rows="filteredRows",
    row-key="id",
    hover,
    clickable-rows,
    :loading="loading",
    sort-by="created_at",
    descending,
    min-width="880px",
    @row-click="openPayout"
  )
    template(#cell-status="{ row }")
      BaseBadge(:variant="statusVariant(row.status)") {{ statusLabel(row.status) }}
    template(#footer)
      .board-payouts__totals
        span {{ payoutsCountLabel(totals.count) }}
        span.board-payouts__sum(v-for="sum in totals.sums", :key="sum") {{ sum }}

  EmptyState(
    v-if="isEmpty",
    title="Выплат нет",
    body="Выплат по выбранным фильтрам не найдено."
  )
    template(#icon)
      q-icon(name="payments", size="48px")

  PayoutDetailOverlay
</template>

<style scoped lang="scss">
.board-payouts {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__search {
    max-width: 420px;
  }

  &__totals {
    width: 100%;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm, 13px);
  }

  &__sum {
    font-family: var(--p-mono);
    color: var(--p-ink);
    font-weight: 600;
  }
}

@media (max-width: 768px) {
  .board-payouts {
    padding: var(--p-4, 16px);
  }
}
</style>
