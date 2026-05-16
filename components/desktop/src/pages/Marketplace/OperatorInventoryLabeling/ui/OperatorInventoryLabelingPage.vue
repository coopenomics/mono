<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { Loading, Notify } from 'quasar';
import { BarcodeDisplay } from 'src/widgets/Marketplace/BarcodeDisplay';
import {
  fetchInventoryByBraname,
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

const braname = ref<string>('');
const orderIdInput = ref<string>('');
const items = ref<MarketplaceInventoryItemView[]>([]);
const loading = ref<boolean>(false);

async function loadInventory(): Promise<void> {
  if (!braname.value.trim()) return;
  loading.value = true;
  try {
    items.value = await fetchInventoryByBraname(braname.value.trim());
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
  // В реальной интеграции braname придёт из current member / маршрута оператора.
  // Здесь — пустой input до явного ввода.
});
</script>

<template lang="pug">
q-page.mp-role-operator.mp-inventory-labeling.q-pa-md
  .row.q-mb-md.q-gutter-md.no-print
    q-input.col-3(
      v-model="braname"
      dense
      outlined
      label="ID кооперативного участка"
      @keyup.enter="loadInventory"
    )
    q-btn(no-caps color="primary" :loading="loading" label="Загрузить инвентарь" @click="loadInventory")
    q-space
    q-btn(flat no-caps icon="print" label="Печать партии" :disable="!items.length" @click="openPrintWindow")

  .row.q-gutter-md.q-mb-md.no-print
    q-input.col-4(
      v-model="orderIdInput"
      dense
      outlined
      label="ID заказа для маркировки"
    )
    q-btn(no-caps unelevated color="primary" label="Сгенерировать этикетки" @click="generateLabels")
    span.text-caption.text-grey-7.self-center
      | Стратегия маркировки берётся из карточки товара поставщика (per-Offer).

  .text-grey-7.text-center.q-pa-xl.no-print(v-if="!items.length")
    | Инвентарь пуст. Загрузите КУ и нажмите «Сгенерировать этикетки» для нового заказа.

  .mp-inventory-labeling__grid(v-else)
    .mp-inventory-labeling__label(v-for="item in items" :key="item.id")
      .text-subtitle2.ellipsis {{ item.product_name_snapshot }}
      .text-caption.text-grey-7.ellipsis.q-mb-xs
        | Пайщик: {{ item.orderer_account_snapshot }} · Кол-во: {{ item.quantity_per_label }}
      BarcodeDisplay(:code="item.barcode_value" size="md")
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
