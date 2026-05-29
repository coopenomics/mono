<script lang="ts" setup>
import type { QTableProps } from 'quasar';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch';
import {
  listIssuancesByBraname,
  type MarketplaceOrderIssuanceView,
} from '../api';
import IssueActOpenDialog from './IssueActOpenDialog.vue';
import IssueActFinalizeDialog from './IssueActFinalizeDialog.vue';

/**
 * Story 6.1 / 6.3 / 6.6: operator-стол выдачи имущества пайщику.
 *
 * Показывает Order'ы на КУ выдачи в статусах ACCEPTED_TO_COOP (ожидают
 * открытия первой подписью председателя — `signiss1`) и READY_TO_RECEIVE
 * (ожидают финальной подписи заказчика на ПВЗ — `signiss2`).
 *
 * - «Открыть выдачу» вызывает IssueActOpenDialog — full-screen takeover
 *   с превью акта (registry_id=1102) и подписью председателя.
 * - «Завершить выдачу» вызывает IssueActFinalizeDialog — BarcodeScanner
 *   для проверки штрих-кода заказа + CorrectionTable со сверкой
 *   факт vs заказ + двойная подпись (заказчик + delivery_signer) и
 *   композитная транзакция `signiss2` с корректирующими операциями
 *   по FR23-FR25.
 */

// Активный КУ оператора — из общего контекста стола (без ввода кода вручную).
const route = useRoute();
const store = useOperatorBranchStore();
const coopname = computed(() => String(route.params.coopname ?? ''));
const braname = computed(() => store.activeBraname ?? '');
const items = ref<MarketplaceOrderIssuanceView[]>([]);
const loading = ref(false);

const openDialog = ref(false);
const finalizeDialog = ref(false);
const selectedOrder = ref<MarketplaceOrderIssuanceView | null>(null);

const ORDER_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Ждёт цикла / решения',
  ACCEPTED_PENDING_SUPPLIER: 'Ждёт поставщика',
  ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL: 'Ждёт поставщика',
  ACCEPTED: 'Принят поставщиком',
  SUPPLY_PREPARED: 'Поставка готовится',
  ACCEPTED_TO_COOP: 'Принят кооперативом',
  READY_TO_RECEIVE: 'Готов к выдаче',
  RECEIVED: 'Получен',
  RETURNED: 'Возвращён',
  CANCELLED_BY_ORDERER: 'Отменён заказчиком',
  CANCELLED_BY_SUPPLIER: 'Отменён поставщиком',
};

const columns: QTableProps['columns'] = [
  { name: 'order', label: 'Заказ', field: (r: MarketplaceOrderIssuanceView) => r.id.slice(0, 8), align: 'left' },
  { name: 'orderer', label: 'Заказчик', field: 'orderer_account', align: 'left' },
  { name: 'quantity', label: 'Количество', field: 'quantity', align: 'right' },
  { name: 'total_cost', label: 'Сумма', field: 'total_cost', align: 'right' },
  { name: 'status', label: 'Статус', field: 'status', align: 'left', format: (v: string) => ORDER_STATUS_LABEL[v] ?? v },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

async function load(): Promise<void> {
  if (!braname.value.trim()) return;
  loading.value = true;
  try {
    items.value = await listIssuancesByBraname(braname.value.trim());
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить ленту выдач');
  } finally {
    loading.value = false;
  }
}

function startOpen(item: MarketplaceOrderIssuanceView): void {
  selectedOrder.value = item;
  openDialog.value = true;
}

function startFinalize(item: MarketplaceOrderIssuanceView): void {
  selectedOrder.value = item;
  finalizeDialog.value = true;
}

function onOpened(): void {
  void load();
}

function onFinalized(): void {
  void load();
}

watch(braname, () => void load());

onMounted(async () => {
  await store.ensureLoaded(coopname.value);
  void load();
});
</script>

<template lang="pug">
q-page.mp-role-operator.mp-issuance.q-pa-md
  OperatorBranchBar

  q-table(
    :rows="items"
    :columns="columns"
    row-key="id"
    flat
    bordered
    :loading="loading"
    no-data-label="Нет заказов, ожидающих выдачи на этом кооперативном участке."
  )
    template(#body-cell-actions="props")
      q-td(:props="props")
        q-btn(
          v-if="props.row.status === 'ACCEPTED_TO_COOP'"
          color="primary"
          unelevated
          no-caps
          dense
          label="Открыть выдачу"
          @click="startOpen(props.row)"
        )
        q-btn(
          v-else-if="props.row.status === 'READY_TO_RECEIVE'"
          color="accent"
          unelevated
          no-caps
          dense
          label="Завершить выдачу"
          @click="startFinalize(props.row)"
        )

  IssueActOpenDialog(
    v-model="openDialog"
    :order="selectedOrder"
    @opened="onOpened"
  )
  IssueActFinalizeDialog(
    v-model="finalizeDialog"
    :order="selectedOrder"
    @finalized="onFinalized"
  )
</template>
