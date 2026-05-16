<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { Loading, Notify } from 'quasar';
import {
  listAplReceptionsAsSupplier,
  signAsSupplier,
  type MarketplaceAplReceptionView,
} from '../api';

/**
 * Story 5.4: стол поставщика — акты приёмки, ожидающие подписи.
 *
 * Каркасная версия (598-18). MVP-режим: подписание без FR45-обвязки
 * (backend сохраняет placeholder tx). После подключения FR45 на клиенте
 * — добавляется загрузка Document2 payload'ов, локальная подпись
 * приватным ключом, отправка `signed_documents` в mutation.
 */

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

async function sign(item: MarketplaceAplReceptionView): Promise<void> {
  Loading.show({ message: 'Подписываю АПП…' });
  try {
    await signAsSupplier(item.id);
    Notify.create({
      type: 'positive',
      message: `АПП ${item.id.slice(0, 8)} подписан.`,
    });
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

onMounted(() => {
  void load();
});
</script>

<template>
  <q-page class="mp-role-offerer mp-pending-apl q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="text-h5">Акты приёмки на подпись</div>
      <q-space />
      <q-btn flat no-caps icon="refresh" label="Обновить" :loading="loading" @click="load" />
    </div>

    <q-table
      :rows="items"
      :columns="[
        { name: 'id', label: 'АПП', field: (r: MarketplaceAplReceptionView) => r.id.slice(0, 8), align: 'left' },
        { name: 'ku_id', label: 'КУ', field: 'ku_id', align: 'left' },
        { name: 'variant', label: 'Вариант', field: 'variant', align: 'center' },
        { name: 'status', label: 'Статус', field: 'status', align: 'left' },
        { name: 'total_amount', label: 'Сумма', field: 'total_amount', align: 'right' },
        { name: 'actions', label: 'Действия', field: 'id', align: 'right' },
      ]"
      row-key="id"
      flat
      bordered
      :loading="loading"
    >
      <template #body-cell-actions="props">
        <q-td :props="props">
          <q-btn
            v-if="props.row.status === 'PENDING_SUPPLIER_SIGN'"
            color="primary"
            unelevated
            no-caps
            dense
            label="Подписать"
            @click="sign(props.row)"
          />
        </q-td>
      </template>
    </q-table>
  </q-page>
</template>
