<script lang="ts" setup>
/**
 * Реестр всех заказов кооператива со статусами (стол администратора).
 * Backend: marketplaceListAllOrders (Order:read:all). По клику строка
 * разворачивается в состояние заказа (таймлайн статусов) и детализацию
 * процесса p.mkt.supply (документы + операции + проводки по order_hash) —
 * через общий виджет ProcessDetailCard. Ссылок на стол бухгалтера нет:
 * № операций/проводок здесь копируются, а не ведут в чужие реестры.
 */
import { onMounted, ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { marketplaceUnitShort } from 'src/shared/lib/consts/marketplace-units';
import { useSystemStore } from 'src/entities/System/model';
import { BaseBadge, EmptyState } from 'src/shared/ui/base';
import { EntityIdBadge } from 'src/shared/ui';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';
import { PageHint } from 'src/shared/ui/domain';
import { ProcessDetailCard } from 'src/widgets/Process/ProcessDetailCard';
import { orderStatusDisplay } from 'src/widgets/Marketplace/OrderCard';
import { fetchAllOrders } from '../api';
import type { AdminOrderView, AdminOrderStatusView } from '../types';

// Процесс marketplace-заказа в реестре процессов — order_hash и есть его хэш.
const SUPPLY_PROCESS_TYPE = 'p.mkt.supply';

const { info } = useSystemStore();

const items = ref<AdminOrderView[]>([]);
const loading = ref(false);
const expanded = ref(new Map<string, boolean>());
const statusFilter = ref<AdminOrderStatusView[]>([]);
const pagination = ref({ page: 1, rowsPerPage: 50, rowsNumber: 0 });

// Полный набор статусов для чипов-фильтра (порядок — по жизненному циклу).
// orderStatusDisplay деградирует мягко, если enum расширится.
const ALL_STATUSES: AdminOrderStatusView[] = [
  'ACTIVE',
  'ACCEPTED_PENDING_SUPPLIER',
  'ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL',
  'ACCEPTED',
  'SUPPLY_PREPARED',
  'ACCEPTED_TO_COOP',
  'READY_TO_RECEIVE',
  'RECEIVED',
  'RETURNED',
  'CANCELLED_BY_ORDERER',
  'CANCELLED_BY_SUPPLIER',
];

const columns = [
  { name: 'expand', align: 'left' as const, label: '', field: 'expand', sortable: false },
  { name: 'status', align: 'left' as const, label: 'Статус', field: 'status' },
  { name: 'order', align: 'left' as const, label: 'Заказ', field: 'id' },
  { name: 'product', align: 'left' as const, label: 'Товар', field: 'product_name' },
  { name: 'orderer', align: 'left' as const, label: 'Заказчик', field: 'orderer_name' },
  { name: 'supplier', align: 'left' as const, label: 'Поставщик', field: 'supplier_name' },
  { name: 'quantity', align: 'right' as const, label: 'Кол-во', field: 'quantity' },
  { name: 'total', align: 'right' as const, label: 'Сумма', field: 'total_cost' },
  { name: 'created', align: 'left' as const, label: 'Создан', field: 'created_at' },
];

function statusLabel(s: string): string {
  return orderStatusDisplay(s).label;
}
function statusVariant(s: string) {
  return orderStatusDisplay(s).variant;
}

function isStatusActive(s: AdminOrderStatusView): boolean {
  return statusFilter.value.includes(s);
}
function toggleStatus(s: AdminOrderStatusView): void {
  statusFilter.value = isStatusActive(s)
    ? statusFilter.value.filter((x) => x !== s)
    : [...statusFilter.value, s];
  reload();
}
function resetFilters(): void {
  if (!statusFilter.value.length) return;
  statusFilter.value = [];
  reload();
}

function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : '—';
}
function unitLabel(o: AdminOrderView): string {
  return marketplaceUnitShort(o.unit_of_measure);
}
function formatTotal(v: string | null | undefined): string {
  return v ? formatAsset2Digits(String(v)) : '—';
}
function formatDate(d: unknown): string {
  if (d === null || d === undefined) return '—';
  const parsed = new Date(String(d));
  return Number.isNaN(parsed.getTime())
    ? String(d)
    : parsed.toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
}

function ordererTitle(o: AdminOrderView): string {
  return o.orderer_name || o.orderer_account || '—';
}
function supplierTitle(o: AdminOrderView): string {
  return o.supplier_name || o.supplier_account || '—';
}

// Состояние заказа — ключевые вехи жизненного цикла с датами. Показываем все
// вехи (с «—» у не наступивших), чтобы администратор видел, где заказ; отмену
// добавляем отдельной строкой только если она была.
interface TimelineEvent { label: string; date: string | null | undefined }
function timelineEvents(o: AdminOrderView): TimelineEvent[] {
  const ev: TimelineEvent[] = [
    { label: 'Размещён', date: (o.blocked_at as string) ?? o.created_at },
    { label: 'Акцепт поставщика', date: o.accepted_at as string },
    { label: 'Принят кооперативом (АПП приёмки)', date: o.chairman_signed_at as string },
    { label: 'Получен заказчиком (АПП выдачи)', date: (o.orderer_signed_at as string) ?? (o.received_at as string) },
  ];
  if (o.cancelled_at) ev.push({ label: 'Отменён', date: o.cancelled_at as string });
  return ev;
}

function toggleExpand(id: string): void {
  expanded.value.set(id, !expanded.value.get(id));
}

let lastRequestId = 0;

async function reload(): Promise<void> {
  pagination.value.page = 1;
  await load();
}

async function load(): Promise<void> {
  const myId = ++lastRequestId;
  loading.value = true;
  try {
    const resp = await fetchAllOrders({
      statuses: statusFilter.value.length ? statusFilter.value : undefined,
      page: pagination.value.page,
      limit: pagination.value.rowsPerPage,
      sortOrder: 'DESC',
    });
    if (myId !== lastRequestId) return;
    items.value = resp.items ?? [];
    pagination.value.rowsNumber = resp.totalCount ?? 0;
  } catch (e) {
    if (myId === lastRequestId) FailAlert(e, 'Не удалось загрузить реестр заказов');
  } finally {
    if (myId === lastRequestId) loading.value = false;
  }
}

function onRequest(props: { pagination: { page: number; rowsPerPage: number; rowsNumber?: number } }): void {
  pagination.value = {
    page: props.pagination.page,
    rowsPerPage: props.pagination.rowsPerPage,
    rowsNumber: props.pagination.rowsNumber ?? pagination.value.rowsNumber,
  };
  void load();
}

onMounted(() => {
  void load();
});
</script>

<template lang="pug">
q-page.admin-orders(role="region", aria-label="Реестр заказов кооператива")
  PageHint(storage-key="mp:admin-orders:banner-dismissed")
    | Реестр всех заказов кооператива с текущими статусами. Раскройте заказ, чтобы увидеть его состояние (таймлайн), документы, операции и проводки процесса.

  .admin-orders__chips(role="group", aria-label="Фильтр по статусу")
    .chip(
      v-for="s in ALL_STATUSES",
      :key="s",
      :class="isStatusActive(s) ? 'chip--accent' : 'chip--neutral'",
      role="button",
      tabindex="0",
      @click="toggleStatus(s)",
      @keydown.enter="toggleStatus(s)"
    ) {{ statusLabel(s) }}
    .chip.chip--reset(
      v-if="statusFilter.length",
      role="button",
      tabindex="0",
      @click="resetFilters",
      @keydown.enter="resetFilters"
    )
      q-icon(name="close", size="14px")
      | Сбросить

  q-card.q-mt-md(flat)
    q-table.full-height(
      flat,
      :rows="items",
      :columns="columns",
      row-key="id",
      :loading="loading",
      :pagination="pagination",
      :rows-per-page-options="[25, 50, 100, 200]",
      no-data-label="Заказы не найдены",
      @request="onRequest"
    )
      template(#body="props")
        q-tr(:key="`ord_${props.row.id}`", :props="props")
          q-td(auto-width)
            ExpandToggleButton(
              :expanded="expanded.get(props.row.id)",
              @click="toggleExpand(props.row.id)"
            )
          q-td
            BaseBadge(:variant="statusVariant(props.row.status)") {{ statusLabel(props.row.status) }}
          q-td
            EntityIdBadge(:rawId="shortId(props.row.id)", copy-on-click)
          q-td {{ props.row.product_name || 'Товар по предложению' }}
          q-td {{ ordererTitle(props.row) }}
          q-td {{ supplierTitle(props.row) }}
          q-td.text-right {{ props.row.quantity }} {{ unitLabel(props.row) }}
          q-td.text-right.font-monospace {{ formatTotal(props.row.total_cost) }}
          q-td {{ formatDate(props.row.created_at) }}

        q-tr.q-virtual-scroll--with-prev(
          no-hover,
          v-if="expanded.get(props.row.id)",
          :key="`exp_${props.row.id}`",
          :props="props"
        )
          q-td(colspan="100%")
            .q-pa-md
              //- Состояние заказа: вехи жизненного цикла с датами.
              q-card.q-mb-md(flat, bordered)
                q-card-section.q-pb-none
                  .text-subtitle2 Состояние заказа
                q-card-section.q-pt-sm
                  .admin-orders__timeline
                    .admin-orders__milestone(v-for="(e, i) in timelineEvents(props.row)", :key="i")
                      .admin-orders__milestone-label {{ e.label }}
                      .admin-orders__milestone-date(:class="{ 'admin-orders__milestone-date--empty': !e.date }") {{ formatDate(e.date) }}
                  .text-caption.text-warning.q-mt-sm(v-if="props.row.last_status_reason")
                    | Причина: {{ props.row.last_status_reason }}

              //- Документы + операции + проводки процесса заказа (общий виджет).
              //- order_hash = хэш процесса p.mkt.supply. Без перехода в чужие реестры.
              ProcessDetailCard(
                v-if="props.row.order_hash",
                :coopname="info.coopname",
                :process-hash="props.row.order_hash",
                :process-type="SUPPLY_PROCESS_TYPE"
              )
              .text-body2.text-grey-7(v-else) Хэш процесса заказа недоступен

      template(#no-data)
        .admin-orders__nodata
          EmptyState(
            title="Заказов нет",
            body="Заказов по выбранным фильтрам не найдено."
          )
            template(#icon)
              q-icon(name="receipt_long", size="48px")
</template>

<style scoped lang="scss">
.admin-orders {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__nodata {
    width: 100%;
    display: flex;
    justify-content: center;
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
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
  }

  &__timeline {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--p-3, 12px);
  }

  &__milestone {
    border-left: 2px solid var(--p-line, #e0e0e0);
    padding-left: var(--p-3, 12px);
  }

  &__milestone-label {
    font-size: var(--p-fs-sm, 12px);
    color: var(--p-ink-3, #757575);
  }

  &__milestone-date {
    font-weight: 500;
    color: var(--p-ink, #212121);

    &--empty {
      color: var(--p-ink-3, #9e9e9e);
      font-weight: 400;
    }
  }
}

.font-monospace {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  letter-spacing: 0.03em;
}

@media (max-width: 768px) {
  .admin-orders {
    padding: var(--p-4, 16px);
  }
}
</style>
