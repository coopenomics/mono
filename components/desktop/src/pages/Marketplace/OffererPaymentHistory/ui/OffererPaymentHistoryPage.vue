<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { Notify } from 'quasar';
import { listMyPayments, type MarketplaceOutgoingPaymentRequestView } from '../api';

const items = ref<MarketplaceOutgoingPaymentRequestView[]>([]);
const loading = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = await listMyPayments();
  } catch (e) {
    Notify.create({
      type: 'negative',
      message: e instanceof Error ? e.message : String(e),
    });
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <q-page class="mp-role-offerer mp-payment-history q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="text-h5">История выплат</div>
      <q-space />
      <q-btn flat no-caps icon="refresh" label="Обновить" :loading="loading" @click="load" />
    </div>

    <q-table
      :rows="items"
      :columns="[
        { name: 'created_at', label: 'Дата', field: 'created_at', align: 'left' },
        { name: 'amount', label: 'Сумма', field: 'amount', align: 'right' },
        { name: 'symbol', label: 'Валюта', field: 'symbol', align: 'center' },
        { name: 'status', label: 'Статус', field: 'status', align: 'left' },
        { name: 'payment_reference', label: 'Референс банка', field: 'payment_reference', align: 'left' },
        { name: 'purpose', label: 'Назначение', field: 'purpose', align: 'left' },
      ]"
      row-key="id"
      flat
      bordered
      :loading="loading"
    />
  </q-page>
</template>
