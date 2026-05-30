<script lang="ts" setup>
import type { QTableProps } from 'quasar';
import { onMounted, ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import { BaseButton, EmptyState } from 'src/shared/ui/base';
import { listMyReadyToReceive, type MarketplaceOrderIssuanceView } from '../api';

/**
 * Story 6.3 / FR22: orderer-стол «Готово к получению».
 *
 * Показывает заказы текущего пайщика в статусе READY_TO_RECEIVE — оператор
 * на ПВЗ уже открыл выдачу первой подписью, пайщик может прийти на КУ для
 * сверки имущества и финальной подписи (`signiss2`). Страница на MONO
 * Platform v2: канон-таблица, пустой экран — `EmptyState`.
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
q-page.ready(role="region", aria-label="Готово к получению")
  .ready__head
    .t-h2 Готово к получению
    .t-muted Оператор открыл выдачу этих заказов на пункте. Приходите на участок для сверки имущества и финальной подписи.

  .ready__toolbar
    q-space
    BaseButton(variant="ghost", :loading="loading", @click="load")
      template(#icon-left)
        q-icon(name="refresh", size="18px")
      | Обновить

  q-table(
    :rows="items",
    :columns="columns",
    row-key="id",
    flat,
    bordered,
    :loading="loading"
  )
    template(#no-data)
      EmptyState(
        title="Нет заказов, готовых к получению",
        body="Как только оператор откроет выдачу заказа, он появится здесь."
      )
        template(#icon)
          q-icon(name="inventory_2", size="48px")
</template>

<style scoped lang="scss">
.ready {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__head {
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
  }

  &__toolbar {
    display: flex;
    align-items: center;
  }
}

@media (max-width: 768px) {
  .ready {
    padding: var(--p-4, 16px);
  }
}
</style>
