<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { Loading, Notify } from 'quasar';
import {
  createAplReception,
  listAplReceptionsByBraname,
  type MarketplaceAplReceptionView,
} from '../api';

/**
 * Story 5.3 + 5.4: operator-стол приёмки партий.
 *
 * Каркасная версия (598-18). Полный flow Варианта А (BarcodeScanner →
 * CorrectionTable → подпись на стойке) и Варианта Б (приём по ТТН с
 * расхождением) включается следующим UI PR.
 */

const braname = ref<string>('');
const items = ref<MarketplaceAplReceptionView[]>([]);
const loading = ref(false);

const shipmentIdInput = ref('');

async function load(): Promise<void> {
  if (!braname.value.trim()) return;
  loading.value = true;
  try {
    items.value = await listAplReceptionsByBraname(braname.value.trim());
  } catch (e) {
    Notify.create({
      type: 'negative',
      message: e instanceof Error ? e.message : String(e),
    });
  } finally {
    loading.value = false;
  }
}

async function createReceptionForShipment(): Promise<void> {
  if (!shipmentIdInput.value.trim()) {
    Notify.create({ type: 'warning', message: 'Укажите ID партии.' });
    return;
  }
  Loading.show({ message: 'Создаю акт приёмки…' });
  try {
    await createAplReception({ shipment_id: shipmentIdInput.value.trim() });
    Notify.create({ type: 'positive', message: 'АПП создан.' });
    shipmentIdInput.value = '';
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
}

function signChairman(item: MarketplaceAplReceptionView): void {
  Notify.create({
    type: 'warning',
    timeout: 6000,
    message:
      `Диалог закрывающей подписи АПП ${item.id.slice(0, 8)} ещё не реализован. ` +
      `Backend принимает только подписанный канонический акт (signed_document с подписью пайщика); ` +
      `UI-флоу подписи через приватный ключ — следующий этап работ.`,
  });
}

onMounted(() => {
  // braname придёт из current member operator-роли при подключении к роутингу.
});
</script>

<template lang="pug">
q-page.mp-role-operator.mp-reception.q-pa-md
  .row.q-mb-md.q-gutter-md
    q-input.col-3(v-model="braname" dense outlined label="ID кооперативного участка")
    q-btn(no-caps color="primary" :loading="loading" label="Загрузить АПП" @click="load")

  .row.q-mb-md.q-gutter-md
    q-input.col-4(v-model="shipmentIdInput" dense outlined label="ID партии (shipment_id)")
    q-btn(no-caps unelevated color="primary" label="Создать АПП" @click="createReceptionForShipment")

  q-table(
    :rows="items"
    :columns="[\
      { name: 'id', label: 'АПП', field: (r: MarketplaceAplReceptionView) => r.id.slice(0, 8), align: 'left' },\
      { name: 'variant', label: 'Вариант', field: 'variant', align: 'center' },\
      { name: 'status', label: 'Статус', field: 'status', align: 'left' },\
      { name: 'total_amount', label: 'Сумма', field: 'total_amount', align: 'right' },\
      { name: 'actions', label: '', field: 'id', align: 'right' },\
    ]"
    row-key="id"
    flat
    bordered
    :loading="loading"
  )
    template(#body-cell-actions="props")
      q-td(:props="props")
        q-btn(
          v-if="props.row.status === 'PENDING_CHAIRMAN_RECEPTION_SIGN'"
          color="primary"
          unelevated
          no-caps
          dense
          label="Подписать председателем"
          @click="signChairman(props.row)"
        )
</template>
