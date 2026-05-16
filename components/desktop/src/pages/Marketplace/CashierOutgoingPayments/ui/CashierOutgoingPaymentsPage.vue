<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { Dialog, Loading, Notify } from 'quasar';
import {
  blockOutgoingPayment,
  confirmOutgoingPayment,
  listOutgoingPaymentsForCashier,
  type MarketplaceOutgoingPaymentRequestView,
} from '../api';

/**
 * Story 5.7: кассирский стол выплат поставщикам.
 *
 * Каркасная версия (598-18). Подключена синхронизация с core
 * outgoing_payment (598-17): запись содержит ссылку `core_payment_id`
 * на платёж в общем реестре кооператива.
 */

const items = ref<MarketplaceOutgoingPaymentRequestView[]>([]);
const loading = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = await listOutgoingPaymentsForCashier(['PENDING_CASHIER_ACTION']);
  } catch (e) {
    Notify.create({
      type: 'negative',
      message: e instanceof Error ? e.message : String(e),
    });
  } finally {
    loading.value = false;
  }
}

function promptConfirm(item: MarketplaceOutgoingPaymentRequestView): void {
  Dialog.create({
    title: 'Подтвердить выплату',
    message: 'Укажите номер банковского платёжного поручения.',
    prompt: { model: '', isValid: (v) => v.length > 0, type: 'text' },
    cancel: true,
    persistent: true,
  }).onOk(async (payment_reference: string) => {
    Loading.show({ message: 'Подтверждаю выплату…' });
    try {
      await confirmOutgoingPayment({
        payment_request_id: item.id,
        payment_reference,
      });
      Notify.create({ type: 'positive', message: 'Выплата подтверждена.' });
      await load();
    } catch (e) {
      Notify.create({
        type: 'negative',
        message: e instanceof Error ? e.message : String(e),
        timeout: 6000,
      });
    } finally {
      Loading.hide();
    }
  });
}

function promptBlock(item: MarketplaceOutgoingPaymentRequestView): void {
  Dialog.create({
    title: 'Заблокировать выплату',
    message: 'Укажите причину блокировки (банк отказал, недостаток средств и т.п.).',
    prompt: { model: '', isValid: (v) => v.length > 0, type: 'text' },
    cancel: true,
    persistent: true,
  }).onOk(async (reason: string) => {
    Loading.show({ message: 'Блокирую…' });
    try {
      await blockOutgoingPayment({ payment_request_id: item.id, reason });
      Notify.create({ type: 'warning', message: 'Выплата заблокирована.' });
      await load();
    } catch (e) {
      Notify.create({
        type: 'negative',
        message: e instanceof Error ? e.message : String(e),
        timeout: 6000,
      });
    } finally {
      Loading.hide();
    }
  });
}

onMounted(() => {
  void load();
});
</script>

<template>
  <q-page class="mp-role-admin mp-cashier-payments q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="text-h5">Выплаты поставщикам</div>
      <q-space />
      <q-btn flat no-caps icon="refresh" label="Обновить" :loading="loading" @click="load" />
    </div>

    <q-table
      :rows="items"
      :columns="[
        { name: 'created_at', label: 'Дата', field: 'created_at', align: 'left' },
        { name: 'payee_account', label: 'Поставщик', field: 'payee_account', align: 'left' },
        { name: 'amount', label: 'Сумма', field: 'amount', align: 'right' },
        { name: 'symbol', label: 'Валюта', field: 'symbol', align: 'center' },
        { name: 'purpose', label: 'Назначение', field: 'purpose', align: 'left' },
        { name: 'core_payment_id', label: 'Core', field: (r: MarketplaceOutgoingPaymentRequestView) => r.core_payment_id ? r.core_payment_id.slice(0, 8) : '—', align: 'center' },
        { name: 'actions', label: '', field: 'id', align: 'right' },
      ]"
      row-key="id"
      flat
      bordered
      :loading="loading"
    >
      <template #body-cell-actions="props">
        <q-td :props="props">
          <q-btn
            color="primary"
            unelevated
            no-caps
            dense
            label="Подтвердить"
            class="q-mr-sm"
            @click="promptConfirm(props.row)"
          />
          <q-btn
            color="negative"
            outline
            no-caps
            dense
            label="Заблокировать"
            @click="promptBlock(props.row)"
          />
        </q-td>
      </template>
    </q-table>
  </q-page>
</template>
