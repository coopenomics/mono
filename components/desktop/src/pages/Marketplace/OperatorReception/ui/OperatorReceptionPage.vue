<script lang="ts" setup>
import type { QTableProps } from 'quasar';
import { onMounted, ref } from 'vue';
import { Loading } from 'quasar';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import {
  createAplReception,
  listAplReceptionsByBraname,
  type MarketplaceAplReceptionView,
} from '../api';
import SignAplReceptionChairmanDialog from './SignAplReceptionChairmanDialog.vue';

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

const RECEPTION_STATUS_LABEL: Record<string, string> = {
  PENDING_SUPPLIER_SIGN: 'Ждёт подписи поставщика',
  PENDING_CHAIRMAN_RECEPTION_SIGN: 'Ждёт подписи председателя КУ',
  ACCEPTED_TO_COOP: 'Принят кооперативом',
  CANCELLED: 'Отменён',
};

const RECEPTION_VARIANT_LABEL: Record<string, string> = {
  IN_PERSON: 'Очная приёмка',
  EXPEDITOR: 'Через экспедитора',
  A: 'Очная приёмка',
  B: 'Через экспедитора',
};

// Ждущие подписи приёмки — наверх: председатель приходит на стол, чтобы
// подписать акты, а не листать уже принятые партии.
const STATUS_SORT_PRIORITY: Record<string, number> = {
  PENDING_CHAIRMAN_RECEPTION_SIGN: 0,
  PENDING_SUPPLIER_SIGN: 1,
  ACCEPTED_TO_COOP: 2,
  CANCELLED: 3,
};

const columns: QTableProps['columns'] = [
  { name: 'id', label: 'АПП', field: (r: MarketplaceAplReceptionView) => r.id.slice(0, 8), align: 'left' },
  { name: 'variant', label: 'Вариант', field: 'variant', align: 'center', format: (v: string) => RECEPTION_VARIANT_LABEL[v] ?? v },
  { name: 'status', label: 'Статус', field: 'status', align: 'left', format: (v: string) => RECEPTION_STATUS_LABEL[v] ?? v },
  { name: 'total_amount', label: 'Сумма', field: 'total_amount', align: 'right' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

async function load(): Promise<void> {
  if (!braname.value.trim()) return;
  loading.value = true;
  try {
    const list = await listAplReceptionsByBraname(braname.value.trim());
    items.value = [...list].sort(
      (a, b) =>
        (STATUS_SORT_PRIORITY[a.status] ?? 99) - (STATUS_SORT_PRIORITY[b.status] ?? 99),
    );
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

const signDialogOpen = ref(false);
const signTarget = ref<MarketplaceAplReceptionView | null>(null);

function signChairman(item: MarketplaceAplReceptionView): void {
  signTarget.value = item;
  signDialogOpen.value = true;
}

async function onChairmanSigned(): Promise<void> {
  await load();
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
    :columns="columns"
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

  SignAplReceptionChairmanDialog(
    v-model="signDialogOpen"
    :reception="signTarget"
    @signed="onChairmanSigned"
  )
</template>
