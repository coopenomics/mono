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
import { useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { marketplaceOrderUnitLabel } from 'src/shared/lib/consts/marketplace-units';
import { useSystemStore } from 'src/entities/System/model';
import { BaseBadge, BaseButton, EmptyState } from 'src/shared/ui/base';
import { EntityIdBadge } from 'src/shared/ui';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';
import { PageHint, ActivityTimeline, type ActivityEvent } from 'src/shared/ui/domain';
import { ProcessDetailCard } from 'src/widgets/Process/ProcessDetailCard';
import { orderStatusDisplay } from 'src/widgets/Marketplace/OrderCard';
import { fetchAllOrders } from '../api';
import type { AdminOrderView, AdminOrderStatusView } from '../types';

// Процесс marketplace-заказа в реестре процессов — order_hash и есть его хэш.
const SUPPLY_PROCESS_TYPE = 'p.mkt.supply';

const { info } = useSystemStore();
const router = useRouter();

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
  return marketplaceOrderUnitLabel(o.unit_of_measure, o.order_unit_size);
}
// requirement b6: реестр показывает сумму, которую реально заплатил пайщик
// (себестоимость + членский взнос, зафиксированный в заказе контрактом) —
// не голую себестоимость товара.
function formatTotalWithFee(o: AdminOrderView): string {
  return formatAsset2Digits(o.total_cost_with_fee);
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

// Состояние заказа — канонической лентой ActivityTimeline: показываем только
// НАСТУПИВШИЕ вехи с датами (текущий статус виден бейджем в строке). Причина
// (last_status_reason) — это описание соответствующего события (отмены/отказа),
// а не отдельная неподписанная строка «Причина» (непонятно «причина чего»).
function orderEvents(o: AdminOrderView): ActivityEvent[] {
  const ev: ActivityEvent[] = [];
  const placed = o.blocked_at ?? o.created_at;
  if (placed) {
    ev.push({ id: 'placed', type: 'create', icon: 'shopping_cart', title: 'Заказ размещён', date: formatDate(placed) });
  }
  if (o.accepted_at) {
    ev.push({ id: 'accepted', type: 'update', icon: 'inventory_2', title: 'Поставщик принял заказ', actor: supplierTitle(o), date: formatDate(o.accepted_at) });
  }
  if (o.chairman_signed_at) {
    ev.push({ id: 'chairman', type: 'sign', title: 'Принят кооперативом (АПП приёмки)', date: formatDate(o.chairman_signed_at) });
  }
  const issued = o.orderer_signed_at ?? o.received_at;
  if (issued) {
    ev.push({ id: 'issued', type: 'sign', title: 'Получен заказчиком (АПП выдачи)', actor: ordererTitle(o), date: formatDate(issued) });
  }
  if (o.cancelled_at) {
    ev.push({ id: 'cancelled', type: 'reject', title: statusLabel(o.status), description: o.last_status_reason || undefined, date: formatDate(o.cancelled_at) });
  } else if (o.last_status_reason) {
    ev.push({ id: 'reason', type: 'comment', title: 'Комментарий к статусу', description: o.last_status_reason, date: formatDate(o.updated_at) });
  }
  return ev;
}

// Переход на карточку предложения (имущества) на столе администратора —
// readonly-карточка, без перехода в каталог/на стол заказчика.
function goToOffer(o: AdminOrderView): void {
  if (!o.offer_id) return;
  void router.push({
    name: 'marketplace-admin-offer-detail',
    params: { coopname: info.coopname, offerId: o.offer_id },
    query: { from: 'orders' },
  });
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
        q-tr(no-hover, :key="`ord_${props.row.id}`", :props="props")
          q-td(auto-width)
            ExpandToggleButton(
              :expanded="expanded.get(props.row.id)",
              @click="toggleExpand(props.row.id)"
            )
          q-td
            BaseBadge(:variant="statusVariant(props.row.status)") {{ statusLabel(props.row.status) }}
          q-td
            EntityIdBadge(:rawId="shortId(props.row.id)", copy-on-click)
          q-td
            .row.items-center.no-wrap.q-gutter-xs
              span {{ props.row.product_name || 'Товар по предложению' }}
              q-icon.cursor-pointer.text-primary(
                v-if="props.row.offer_id",
                name="open_in_new",
                size="16px",
                @click="goToOffer(props.row)"
              )
                q-tooltip Открыть предложение
          q-td {{ ordererTitle(props.row) }}
          q-td {{ supplierTitle(props.row) }}
          q-td.text-right {{ props.row.quantity }} {{ unitLabel(props.row) }}
          q-td.text-right.font-monospace {{ formatTotalWithFee(props.row) }}
          q-td {{ formatDate(props.row.created_at) }}

        q-tr.q-virtual-scroll--with-prev(
          no-hover,
          v-if="expanded.get(props.row.id)",
          :key="`exp_${props.row.id}`",
          :props="props"
        )
          q-td(colspan="100%")
            .q-pa-md
              //- Состояние заказа — канонический таймлайн (ActivityTimeline) +
              //- переход на карточку предложения (имущества).
              q-card.q-mb-md(flat, bordered)
                q-card-section.row.items-center.justify-between.q-pb-none
                  .text-subtitle2 Состояние заказа
                  BaseButton(
                    v-if="props.row.offer_id",
                    variant="secondary",
                    size="sm",
                    @click="goToOffer(props.row)"
                  )
                    template(#icon-left)
                      q-icon(name="open_in_new", size="16px")
                    | Открыть предложение
                q-card-section.q-pt-sm
                  ActivityTimeline(:events="orderEvents(props.row)")

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

  // Реестр — обзорный список, не интерактивные строки: гасим подсветку строки
  // при наведении (canon-правило .q-table tbody tr:hover) и в основной таблице,
  // и во вложенных таблицах детализации (операции/проводки) — мигание мешает.
  :deep(.q-table tbody tr:hover) {
    background: transparent;
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
