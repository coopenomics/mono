<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { Loading, Notify } from 'quasar';
import { BarcodeDisplay } from 'src/widgets/Marketplace/BarcodeDisplay';
import {
  fetchInventoryByKu,
  labelInventory,
  type MarketplaceInventoryItemView,
} from '../api';

/**
 * Story 5.5 + техдолг 598-21: операторский стол маркировки имущества.
 *
 * Левая колонка — ввод order_id и кнопка «Сгенерировать этикетки».
 * Правая колонка — batch-режим печати: все этикетки текущей партии
 * выводятся в одну сетку для печати на принтере 80×40 мм одним заданием.
 *
 * Стратегия маркировки читается из Offer по умолчанию (per-Offer
 * `barcode_strategy`, техдолг 598-22), кнопки переопределения остаются
 * как admin-override. Канон widget: `BarcodeDisplay` (UX-DR12).
 */

const ku_id = ref<string>('');
const orderIdInput = ref<string>('');
const items = ref<MarketplaceInventoryItemView[]>([]);
const loading = ref<boolean>(false);

async function loadInventory(): Promise<void> {
  if (!ku_id.value.trim()) return;
  loading.value = true;
  try {
    items.value = await fetchInventoryByKu(ku_id.value.trim());
  } catch (e) {
    Notify.create({
      type: 'negative',
      message: e instanceof Error ? e.message : String(e),
    });
  } finally {
    loading.value = false;
  }
}

async function generateLabels(): Promise<void> {
  if (!orderIdInput.value.trim()) {
    Notify.create({ type: 'warning', message: 'Укажите идентификатор заказа.' });
    return;
  }
  Loading.show({ message: 'Генерирую этикетки…' });
  try {
    const result = await labelInventory({ order_id: orderIdInput.value.trim() });
    Notify.create({
      type: 'positive',
      message: `Сгенерировано ${result.inventory.length} этикеток. Можно печатать.`,
    });
    orderIdInput.value = '';
    await loadInventory();
  } catch (e) {
    Notify.create({
      type: 'negative',
      message: e instanceof Error ? e.message : String(e),
      timeout: 6000,
    });
  } finally {
    Loading.hide();
  }
}

function openPrintWindow(): void {
  window.print();
}

onMounted(() => {
  // В реальной интеграции ku_id придёт из current member / маршрута оператора.
  // Здесь — пустой input до явного ввода.
});
</script>

<template>
  <q-page class="mp-role-operator mp-inventory-labeling q-pa-md">
    <div class="row q-mb-md q-gutter-md no-print">
      <q-input
        v-model="ku_id"
        dense
        outlined
        label="ID кооперативного участка"
        class="col-3"
        @keyup.enter="loadInventory"
      />
      <q-btn no-caps color="primary" :loading="loading" label="Загрузить инвентарь" @click="loadInventory" />
      <q-space />
      <q-btn flat no-caps icon="print" label="Печать партии" :disable="!items.length" @click="openPrintWindow" />
    </div>

    <div class="row q-gutter-md q-mb-md no-print">
      <q-input
        v-model="orderIdInput"
        dense
        outlined
        label="ID заказа для маркировки"
        class="col-4"
      />
      <q-btn no-caps unelevated color="primary" label="Сгенерировать этикетки" @click="generateLabels" />
      <span class="text-caption text-grey-7 self-center">
        Стратегия маркировки берётся из карточки товара поставщика (per-Offer).
      </span>
    </div>

    <div v-if="!items.length" class="text-grey-7 text-center q-pa-xl no-print">
      Инвентарь пуст. Загрузите КУ и нажмите «Сгенерировать этикетки» для нового заказа.
    </div>

    <div v-else class="mp-inventory-labeling__grid">
      <div
        v-for="item in items"
        :key="item.id"
        class="mp-inventory-labeling__label"
      >
        <div class="text-subtitle2 ellipsis">{{ item.product_name_snapshot }}</div>
        <div class="text-caption text-grey-7 ellipsis q-mb-xs">
          Пайщик: {{ item.orderer_account_snapshot }} · Кол-во: {{ item.quantity_per_label }}
        </div>
        <BarcodeDisplay :code="item.barcode_value" size="md" />
      </div>
    </div>
  </q-page>
</template>

<style scoped lang="scss">
.mp-inventory-labeling {
  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--mp-space-md);
  }

  &__label {
    border: 1px solid var(--mp-border-color, #e0e0e0);
    border-radius: var(--mp-radius-sm, 4px);
    padding: var(--mp-space-sm);
    background: #fff;
    break-inside: avoid;
  }
}

@media print {
  .no-print { display: none !important; }
  .mp-inventory-labeling__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
