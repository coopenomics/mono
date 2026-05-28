<script lang="ts" setup>
import type { QTableProps } from 'quasar';
import { onMounted, ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import { listMyReadyToReceive, type MarketplaceOrderIssuanceView } from '../api';

/**
 * Story 6.3 / FR22: каркас orderer-стола «Готово к получению».
 *
 * Показывает заказы текущего пайщика в статусе READY_TO_RECEIVE — оператор
 * на ПВЗ уже открыл выдачу первой подписью, пайщик может прийти на КУ для
 * сверки имущества и финальной подписи (`signiss2`).
 *
 * Push-уведомление marketplace-order-ready (FR22) шлётся бэком сразу
 * после `signiss1` через MarketplaceNotificationService; этот стол —
 * визуальное продолжение уведомления.
 */

const items = ref<MarketplaceOrderIssuanceView[]>([]);
const loading = ref(false);

function formatDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('ru-RU');
}

const columns: QTableProps['columns'] = [
  { name: 'order', label: 'Заказ', field: (r: MarketplaceOrderIssuanceView) => r.id.slice(0, 8), align: 'left' },
  { name: 'ku', label: 'Пункт выдачи', field: 'delivery_braname', align: 'left' },
  { name: 'quantity', label: 'Количество', field: 'quantity', align: 'right' },
  { name: 'total_cost', label: 'Сумма заказа', field: 'total_cost', align: 'right' },
  {
    name: 'opened_at',
    label: 'Открыто к выдаче',
    field: 'chairman_signed_at',
    align: 'left',
    format: (v: unknown) => formatDate(v),
  },
];

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = await listMyReadyToReceive();
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить заказы, готовые к получению');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template lang="pug">
q-page.mp-role-orderer.mp-issuance-ready.q-pa-md
  .row.q-mb-md.items-center.justify-between
    .text-h6 Готово к получению
    q-btn(flat dense no-caps :loading="loading" icon="refresh" label="Обновить" @click="load")

  q-table(
    :rows="items"
    :columns="columns"
    row-key="id"
    flat
    bordered
    :loading="loading"
    no-data-label="Нет заказов, готовых к получению."
  )
</template>
