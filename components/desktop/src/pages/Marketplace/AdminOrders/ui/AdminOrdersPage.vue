<script lang="ts" setup>
/**
 * Реестр всех заказов кооператива со статусами (стол администратора).
 * Backend: marketplaceListAllOrders (Order:read:all). Таблица и фильтр —
 * общий виджет OrdersRegistryTable (тот же, что у стола ПВЗ,
 * marketplaceListBranchOrders) — правка вёрстки в одном месте чинит оба
 * стола. Строка открывает страницу заказа этого же стола.
 */
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { PageHint } from 'src/shared/ui/domain';
import { OrdersRegistryTable, type OrderRegistryStatusView } from 'src/widgets/Marketplace/OrdersRegistryTable';
import { OrderRegistryOverlay } from 'src/widgets/Marketplace/OrderRegistryOverlay';
import { useQueryOverlay } from 'src/shared/lib/navigation';
import { fetchAllOrders } from '../api';
import type { AdminOrderView } from '../types';

const { info } = useSystemStore();
const router = useRouter();
const orderOverlay = useQueryOverlay('order');

const items = ref<AdminOrderView[]>([]);
const loading = ref(false);
const statusFilter = ref<OrderRegistryStatusView[]>([]);
const pagination = ref({ page: 1, rowsPerPage: 50, rowsNumber: 0 });

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

function onStatusFilterUpdate(value: OrderRegistryStatusView[]): void {
  statusFilter.value = value;
  void reload();
}

function onRequest(props: { pagination: { page: number; rowsPerPage: number; rowsNumber?: number } }): void {
  pagination.value = {
    page: props.pagination.page,
    rowsPerPage: props.pagination.rowsPerPage,
    rowsNumber: props.pagination.rowsNumber ?? pagination.value.rowsNumber,
  };
  void load();
}

// Заказ открывается оверлеем поверх реестра: страница пагинации и фильтр
// статусов остаются на месте, полная страница — по кнопке в оверлее
function goToOrder(orderId: string): void {
  orderOverlay.open(orderId);
}

// Переход на карточку предложения (имущества) на столе администратора —
// readonly-карточка, без перехода в каталог/на стол заказчика.
function goToOffer(offerId: string): void {
  void router.push({
    name: 'marketplace-admin-offer-detail',
    params: { coopname: info.coopname, offerId },
    query: { from: 'orders' },
  });
}

onMounted(() => {
  void load();
});
</script>

<template lang="pug">
q-page.admin-orders
  PageHint(storage-key="mp:admin-orders:banner-dismissed")
    | Реестр всех заказов кооператива с текущими статусами. Откройте заказ, чтобы увидеть его состояние, документы, операции и проводки процесса.

  OrdersRegistryTable(
    :items="items",
    :loading="loading",
    :pagination="pagination",
    :status-filter="statusFilter",
    @update:status-filter="onStatusFilterUpdate",
    @request="onRequest",
    @order-click="goToOrder",
    @offer-click="goToOffer"
  )

  OrderRegistryOverlay(
    :coopname="info.coopname",
    full-page-route-name="marketplace-admin-order-detail",
    @offer-click="goToOffer"
  )
</template>

<style scoped lang="scss">
.admin-orders {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
}

@media (max-width: 768px) {
  .admin-orders {
    padding: var(--p-4, 16px);
  }
}
</style>
