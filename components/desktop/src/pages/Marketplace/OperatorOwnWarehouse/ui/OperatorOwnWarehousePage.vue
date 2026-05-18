<template>
  <q-page class="mp-role-operator q-pa-md">
    <div class="text-h5 q-mb-md">Склад моего КУ</div>

    <q-card class="mp-card q-mb-md">
      <q-card-section class="q-gutter-sm">
        <div class="row q-col-gutter-sm items-end">
          <q-input
            v-model="braname"
            label="Код КУ (braname)"
            dense
            outlined
            class="col-12 col-sm-4"
            @keyup.enter="load"
          />
          <q-select
            v-model="statusFilter"
            :options="statusOptions"
            label="Статус"
            dense
            outlined
            multiple
            emit-value
            map-options
            class="col-12 col-sm-3"
          />
          <q-input
            v-model="ordererFilter"
            label="Заказчик (orderer)"
            dense
            outlined
            class="col-12 col-sm-3"
          />
          <q-btn
            color="primary"
            label="Обновить"
            class="col-12 col-sm-2"
            :loading="loading"
            @click="load"
          />
        </div>
      </q-card-section>
    </q-card>

    <div v-if="items.length" class="row q-col-gutter-md q-mb-md">
      <q-card class="mp-card col-12 col-sm-3">
        <q-card-section>
          <div class="text-caption text-grey-7">Активных наклеек</div>
          <div class="text-h6">{{ summary.totalActive }}</div>
        </q-card-section>
      </q-card>
      <q-card
        v-for="(count, status) in summary.byStatus"
        :key="status"
        class="mp-card col-12 col-sm-3"
      >
        <q-card-section>
          <div class="text-caption text-grey-7">{{ humanStatus(status) }}</div>
          <div class="text-h6">{{ count }}</div>
        </q-card-section>
      </q-card>
    </div>

    <q-table
      class="mp-card"
      :rows="filteredRows"
      :columns="columns"
      row-key="id"
      :loading="loading"
      :pagination="{ rowsPerPage: 25, sortBy: 'labeled_at', descending: true }"
      :rows-per-page-options="[25, 50, 100, 0]"
      flat
      bordered
      binary-state-sort
    >
      <template #body-cell-status="props">
        <q-td :props="props">
          <span class="mp-status-chip" :class="statusChipClass(props.row.status)">
            {{ humanStatus(props.row.status) }}
          </span>
        </q-td>
      </template>

      <template #body-cell-age="props">
        <q-td :props="props">{{ formatAge(props.row.labeled_at) }}</q-td>
      </template>

      <template #body-cell-labeled_at="props">
        <q-td :props="props">{{ formatDateTime(props.row.labeled_at) }}</q-td>
      </template>

      <template #no-data>
        <div class="full-width text-center q-pa-md text-grey-7">
          {{
            braname
              ? 'Наклеек по этому КУ нет — проверьте код или статусы.'
              : 'Введите код КУ и нажмите «Обновить».'
          }}
        </div>
      </template>
    </q-table>
  </q-page>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import type { QTableProps } from 'quasar';
import { FailAlert } from 'src/shared/api';
import { listInventory, type MarketplaceInventoryItemView } from '../api';

const braname = ref<string>('');
const statusFilter = ref<string[]>([]);
const ordererFilter = ref<string>('');
const items = ref<MarketplaceInventoryItemView[]>([]);
const loading = ref(false);

type InventoryStatus = MarketplaceInventoryItemView['status'];

const statusOptions: { label: string; value: InventoryStatus }[] = [
  { label: 'На складе (LABELED)', value: 'LABELED' },
  { label: 'Выдано пайщику (ISSUED)', value: 'ISSUED' },
  { label: 'Возврат на склад (RETURNED)', value: 'RETURNED' },
  { label: 'Списано (WRITTEN_OFF)', value: 'WRITTEN_OFF' },
];

const columns: QTableProps['columns'] = [
  { name: 'barcode_value', label: 'Штрих-код', field: 'barcode_value', align: 'left', sortable: true },
  { name: 'product', label: 'Товар', field: 'product_name_snapshot', align: 'left', sortable: true },
  { name: 'orderer', label: 'Заказчик', field: 'orderer_account_snapshot', align: 'left', sortable: true },
  { name: 'quantity', label: 'Ед.', field: 'quantity_per_label', align: 'right', sortable: true },
  { name: 'status', label: 'Статус', field: 'status', align: 'left', sortable: true },
  { name: 'age', label: 'Возраст', field: 'labeled_at', align: 'right' },
  { name: 'labeled_at', label: 'Промаркировано', field: 'labeled_at', align: 'left', sortable: true },
];

const filteredRows = computed(() => {
  const orderer = ordererFilter.value.trim().toLowerCase();
  return items.value.filter((row) => {
    if (statusFilter.value.length && !statusFilter.value.includes(row.status)) {
      return false;
    }
    if (orderer && !row.orderer_account_snapshot.toLowerCase().includes(orderer)) {
      return false;
    }
    return true;
  });
});

const summary = computed(() => {
  const byStatus: Record<string, number> = {};
  for (const row of items.value) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
  }
  return {
    byStatus,
    totalActive:
      (byStatus.LABELED ?? 0) +
      (byStatus.ISSUED ?? 0) +
      (byStatus.RETURNED ?? 0),
  };
});

async function load(): Promise<void> {
  if (!braname.value.trim()) {
    items.value = [];
    return;
  }
  loading.value = true;
  try {
    items.value = await listInventory({ braname: braname.value.trim() });
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить склад КУ');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});

function humanStatus(status: string): string {
  switch (status) {
    case 'LABELED':
      return 'На складе';
    case 'ISSUED':
      return 'Выдано пайщику';
    case 'RETURNED':
      return 'Возврат на склад';
    case 'WRITTEN_OFF':
      return 'Списано';
    default:
      return status;
  }
}

function statusChipClass(status: string): string {
  switch (status) {
    case 'LABELED':
      return 'mp-status-chip--info';
    case 'ISSUED':
      return 'mp-status-chip--success';
    case 'RETURNED':
      return 'mp-status-chip--warning';
    case 'WRITTEN_OFF':
      return 'mp-status-chip--error';
    default:
      return 'mp-status-chip--neutral';
  }
}

function formatAge(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return '—';
  const days = Math.floor((Date.now() - parsed.getTime()) / 86_400_000);
  if (days <= 0) return 'сегодня';
  if (days === 1) return '1 день';
  if (days < 5) return `${days} дня`;
  return `${days} дней`;
}

function formatDateTime(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('ru-RU');
}
</script>
