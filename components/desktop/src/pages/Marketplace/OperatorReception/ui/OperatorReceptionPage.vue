<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { Loading } from 'quasar';
import { SuccessAlert, FailAlert, NotifyAlert } from 'src/shared/api';
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
    FailAlert(e, 'Не удалось загрузить акты приёмки');
  } finally {
    loading.value = false;
  }
}

async function createReceptionForShipment(): Promise<void> {
  if (!shipmentIdInput.value.trim()) {
    FailAlert(new Error('Укажите ID партии.'));
    return;
  }
  Loading.show({ message: 'Создаю акт приёмки…' });
  try {
    await createAplReception({ shipment_id: shipmentIdInput.value.trim() });
    SuccessAlert('Акт приёмки создан');
    shipmentIdInput.value = '';
    await load();
  } catch (e) {
    FailAlert(e, 'Не удалось создать акт приёмки');
  } finally {
    Loading.hide();
  }
}

function signChairman(item: MarketplaceAplReceptionView): void {
  NotifyAlert(
    `Диалог подписи АПП ${item.id.slice(0, 8)} в разработке`,
    'Backend принимает только подписанный канонический акт (signed_document с подписью). UI-флоу подписи через приватный ключ председателя — следующий этап работ.'
  );
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
    :columns="[
      { name: 'id', label: 'АПП', field: (r: MarketplaceAplReceptionView) => r.id.slice(0, 8), align: 'left' },
      { name: 'variant', label: 'Вариант', field: 'variant', align: 'center' },
      { name: 'status', label: 'Статус', field: 'status', align: 'left' },
      { name: 'total_amount', label: 'Сумма', field: 'total_amount', align: 'right' },
      { name: 'actions', label: '', field: 'id', align: 'right' },
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
