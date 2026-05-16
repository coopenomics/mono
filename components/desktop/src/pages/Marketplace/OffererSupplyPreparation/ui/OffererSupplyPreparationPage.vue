<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { Notify } from 'quasar';
import { listShipments, type MarketplaceShipmentView } from '../api';

/**
 * Story 5.1 / 5.2: стол поставщика — подготовка партий поставки.
 *
 * Каркасная версия (598-18): загружает партии текущего поставщика и
 * показывает таблицу. Группировка через `ExpeditorGroupingBoard` и
 * печать ТТН через `TTNPrintPreview` подключаются во вторую UI-волну.
 */

const items = ref<MarketplaceShipmentView[]>([]);
const loading = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = await listShipments();
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

<template lang="pug">
q-page.mp-role-offerer.mp-supply-preparation.q-pa-md
  .row.items-center.q-mb-md
    .text-h5 Подготовка поставки
    q-space
    q-btn(flat no-caps icon="refresh" label="Обновить" :loading="loading" @click="load")

  q-table(
    :rows="items"
    :columns="[\
      { name: 'cycle_id', label: 'Цикл', field: 'cycle_id', align: 'left' },\
      { name: 'braname', label: 'КУ', field: 'braname', align: 'left' },\
      { name: 'delivery_variant', label: 'Вариант', field: 'delivery_variant', align: 'center' },\
      { name: 'status', label: 'Статус', field: 'status', align: 'left' },\
      { name: 'total_amount', label: 'Сумма', field: 'total_amount', align: 'right' },\
      { name: 'ttn_number', label: 'ТТН', field: 'ttn_number', align: 'left' },\
    ]"
    row-key="id"
    flat
    bordered
    :loading="loading"
  )

  .text-caption.text-grey-7.q-mt-md
    | Группировка drag-n-drop и печать ТТН подключаются вторым UI-PR'ом
    | (канон widget'ов: ExpeditorGroupingBoard, TTNPrintPreview).
</template>
