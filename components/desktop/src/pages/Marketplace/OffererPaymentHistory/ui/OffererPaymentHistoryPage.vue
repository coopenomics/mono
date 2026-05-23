<script lang="ts" setup>
import type { QTableProps } from 'quasar';
import { onMounted, ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import { listMyPayments, type MarketplaceOutgoingPaymentRequestView } from '../api';

const items = ref<MarketplaceOutgoingPaymentRequestView[]>([]);
const loading = ref(false);

const columns: QTableProps['columns'] = [
  { name: 'created_at', label: 'Дата', field: 'created_at', align: 'left' },
  { name: 'amount', label: 'Сумма', field: 'amount', align: 'right' },
  { name: 'symbol', label: 'Валюта', field: 'symbol', align: 'center' },
  { name: 'status', label: 'Статус', field: 'status', align: 'left' },
  { name: 'payment_reference', label: 'Референс банка', field: 'payment_reference', align: 'left' },
  { name: 'purpose', label: 'Назначение', field: 'purpose', align: 'left' },
];

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = await listMyPayments();
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить историю выплат');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template lang="pug">
q-page.mp-role-offerer.mp-payment-history.q-pa-md
  .row.items-center.q-mb-md
    .text-h5 История выплат
    q-space
    q-btn(flat no-caps icon="refresh" label="Обновить" :loading="loading" @click="load")

  q-table(
    :rows="items"
    :columns="columns"
    row-key="id"
    flat
    bordered
    :loading="loading"
  )
</template>
