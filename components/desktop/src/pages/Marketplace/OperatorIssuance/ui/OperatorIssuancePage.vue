<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { FailAlert, NotifyAlert } from 'src/shared/api';
import {
  listIssuancesByBraname,
  type MarketplaceOrderIssuanceView,
} from '../api';

/**
 * Story 6.1 / 6.3: каркас operator-стола выдачи имущества пайщику.
 *
 * Показывает Order'ы на КУ выдачи в статусах ACCEPTED_TO_COOP (ожидают
 * открытия первой подписью председателя — `signiss1`) и READY_TO_RECEIVE
 * (ожидают финальной подписи заказчика на ПВЗ — `signiss2`).
 *
 * Полный flow подписи (BarcodeScanner с штрих-кода заказа, CorrectionTable
 * со сверкой факт vs заказ, TakeoverDialog для двух подписей) включается
 * следующим UI PR. Бэкенд уже принимает signed_document с подписями и
 * исполняет все три ветки сверки в C++ `signiss2`.
 */

const braname = ref<string>('');
const items = ref<MarketplaceOrderIssuanceView[]>([]);
const loading = ref(false);

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

function openIssuance(item: MarketplaceOrderIssuanceView): void {
  NotifyAlert(
    `Диалог открытия выдачи заказа ${item.id.slice(0, 8)} в разработке`,
    'Backend принимает только подписанный канонический акт выдачи (signed_document с подписью председателя). UI-флоу подписи через приватный ключ председателя — следующий этап работ.',
  );
}

function finalizeIssuance(item: MarketplaceOrderIssuanceView): void {
  NotifyAlert(
    `Диалог финальной подписи заказа ${item.id.slice(0, 8)} в разработке`,
    'Backend принимает signed_document с двумя подписями (заказчик + делегат кооператива), actual_quantity и delivery_signer. Композитная транзакция signiss2 на цепи исполнит корректирующие операции по сверке факт vs заказ.',
  );
}

onMounted(() => {
  // braname придёт из current member operator-роли при подключении к роутингу.
});
</script>

<template lang="pug">
q-page.mp-role-operator.mp-issuance.q-pa-md
  .row.q-mb-md.q-gutter-md
    q-input.col-3(v-model="braname" dense outlined label="ID кооперативного участка выдачи")
    q-btn(no-caps color="primary" :loading="loading" label="Загрузить ленту выдач" @click="load")

  q-table(
    :rows="items"
    :columns="[
      { name: 'order', label: 'Заказ', field: (r: MarketplaceOrderIssuanceView) => r.id.slice(0, 8), align: 'left' },
      { name: 'orderer', label: 'Заказчик', field: 'orderer_account', align: 'left' },
      { name: 'quantity', label: 'Количество', field: 'quantity', align: 'right' },
      { name: 'total_cost', label: 'Сумма', field: 'total_cost', align: 'right' },
      { name: 'status', label: 'Статус', field: 'status', align: 'left' },
      { name: 'actions', label: '', field: 'id', align: 'right' },
    ]"
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
          @click="openIssuance(props.row)"
        )
        q-btn(
          v-else-if="props.row.status === 'READY_TO_RECEIVE'"
          color="accent"
          unelevated
          no-caps
          dense
          label="Завершить выдачу"
          @click="finalizeIssuance(props.row)"
        )
</template>
