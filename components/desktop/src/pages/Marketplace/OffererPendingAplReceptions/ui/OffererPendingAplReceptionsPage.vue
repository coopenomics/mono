<script lang="ts" setup>
import type { QTableProps } from 'quasar';
import { onMounted, ref } from 'vue';
import { FailAlert, NotifyAlert } from 'src/shared/api';
import {
  listAplReceptionsAsSupplier,
  type MarketplaceAplReceptionView,
} from '../api';

const items = ref<MarketplaceAplReceptionView[]>([]);
const loading = ref(false);

const columns: QTableProps['columns'] = [
  { name: 'id', label: 'АПП', field: (r: MarketplaceAplReceptionView) => r.id.slice(0, 8), align: 'left' },
  { name: 'braname', label: 'КУ', field: 'braname', align: 'left' },
  { name: 'variant', label: 'Вариант', field: 'variant', align: 'center' },
  { name: 'status', label: 'Статус', field: 'status', align: 'left' },
  { name: 'total_amount', label: 'Сумма', field: 'total_amount', align: 'right' },
  { name: 'actions', label: 'Действия', field: 'id', align: 'right' },
];

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = await listAplReceptionsAsSupplier();
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить акты на подпись');
  } finally {
    loading.value = false;
  }
}

function sign(item: MarketplaceAplReceptionView): void {
  NotifyAlert(
    `Диалог подписи АПП ${item.id.slice(0, 8)} в разработке`,
    'Backend принимает только подписанный канонический акт (signed_document с подписью). UI-флоу подписи через приватный ключ поставщика — следующий этап работ.'
  );
}

onMounted(() => {
  void load();
});
</script>

<template lang="pug">
q-page.mp-role-offerer.mp-pending-apl.q-pa-md
  .row.items-center.q-mb-md
    .text-h5 Акты приёмки на подпись
    q-space
    q-btn(flat no-caps icon="refresh" label="Обновить" :loading="loading" @click="load")

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
          v-if="props.row.status === 'PENDING_SUPPLIER_SIGN'"
          color="primary"
          unelevated
          no-caps
          dense
          label="Подписать"
          @click="sign(props.row)"
        )
</template>
