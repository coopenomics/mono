<script lang="ts" setup>
/**
 * Реестр заказов, идущих на кооперативный участок (стол ПВЗ). Backend:
 * marketplaceListBranchOrders (Order:read:own-KU). Таблица и фильтр — общий
 * виджет OrdersRegistryTable (тот же, что у стола администратора) — правка
 * вёрстки в одном месте чинит оба стола. Строка открывает страницу заказа
 * участка; на неё же ведёт ссылка из движения в «Экономике участка».
 */
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch';
import { EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { OrdersRegistryTable, type OrderRegistryStatusView, type OrderRegistryView } from 'src/widgets/Marketplace/OrdersRegistryTable';
import { fetchBranchOrders } from '../api';

const route = useRoute();
const router = useRouter();
const store = useOperatorBranchStore();

const coopname = computed(() => String(route.params.coopname ?? ''));
const braname = computed(() => store.activeBraname ?? '');

const items = ref<OrderRegistryView[]>([]);
const loading = ref(true);
const statusFilter = ref<OrderRegistryStatusView[]>([]);
const pagination = ref({ page: 1, rowsPerPage: 50, rowsNumber: 0 });

let lastRequestId = 0;

async function reload(): Promise<void> {
  pagination.value.page = 1;
  await load();
}

async function load(): Promise<void> {
  if (!braname.value) return;
  const myId = ++lastRequestId;
  loading.value = true;
  try {
    const resp = await fetchBranchOrders(braname.value, {
      statuses: statusFilter.value.length ? statusFilter.value : undefined,
      page: pagination.value.page,
      limit: pagination.value.rowsPerPage,
      sortOrder: 'DESC',
    });
    if (myId !== lastRequestId) return;
    items.value = resp.items ?? [];
    pagination.value.rowsNumber = resp.totalCount ?? 0;
  } catch (e) {
    if (myId === lastRequestId) FailAlert(e, 'Не удалось загрузить реестр заказов участка');
  } finally {
    if (myId === lastRequestId) loading.value = false;
  }
}

function goToOrder(orderId: string): void {
  void router.push({
    name: 'marketplace-pvz-order-detail',
    params: { coopname: coopname.value, orderId },
  });
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

onMounted(async () => {
  await store.ensureLoaded(coopname.value);
  void load();
});

watch(braname, () => void load());
</script>

<template lang="pug">
q-page.operator-orders
  OperatorBranchBar

  EmptyState(
    v-if='store.loaded && !store.isOperator',
    title='Вы не оператор кооперативного участка',
    body='Реестр заказов участка доступен оператору участка и его доверенным.'
  )
    template(#icon)
      q-icon(name='receipt_long', size='48px')

  template(v-else)
    PageHint(storage-key="mp:operator-orders:banner-dismissed")
      | Заказы, идущие на ваш пункт выдачи, с текущими статусами. Откройте заказ, чтобы увидеть его состояние, документы и операции — например, по ссылке из движения в «Экономике участка».

    OrdersRegistryTable(
      :items="items",
      :loading="loading",
      :pagination="pagination",
      :status-filter="statusFilter",
      :show-offer-link="false",
      @update:status-filter="onStatusFilterUpdate",
      @order-click="goToOrder",
      @request="onRequest"
    )
</template>

<style scoped lang="scss">
.operator-orders {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
}

@media (max-width: 768px) {
  .operator-orders {
    padding: var(--p-4, 16px);
  }
}
</style>
