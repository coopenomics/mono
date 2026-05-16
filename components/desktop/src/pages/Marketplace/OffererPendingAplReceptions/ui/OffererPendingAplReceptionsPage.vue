<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { Notify } from 'quasar';
import {
  listAplReceptionsAsSupplier,
  type MarketplaceAplReceptionView,
} from '../api';

const items = ref<MarketplaceAplReceptionView[]>([]);
const loading = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = await listAplReceptionsAsSupplier();
  } catch (e) {
    Notify.create({
      type: 'negative',
      message: e instanceof Error ? e.message : String(e),
    });
  } finally {
    loading.value = false;
  }
}

function sign(item: MarketplaceAplReceptionView): void {
  Notify.create({
    type: 'warning',
    timeout: 6000,
    message:
      `Диалог подписи акта приёмки ${item.id.slice(0, 8)} ещё не реализован. ` +
      `Backend принимает только подписанный канонический акт (signed_document с подписью пайщика); ` +
      `UI-флоу подписи через приватный ключ — следующий этап работ.`,
  });
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
    :columns="[\
      { name: 'id', label: 'АПП', field: (r: MarketplaceAplReceptionView) => r.id.slice(0, 8), align: 'left' },\
      { name: 'braname', label: 'КУ', field: 'braname', align: 'left' },\
      { name: 'variant', label: 'Вариант', field: 'variant', align: 'center' },\
      { name: 'status', label: 'Статус', field: 'status', align: 'left' },\
      { name: 'total_amount', label: 'Сумма', field: 'total_amount', align: 'right' },\
      { name: 'actions', label: 'Действия', field: 'id', align: 'right' },\
    ]"
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
