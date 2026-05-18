<template>
  <q-page class="mp-role-admin q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="text-h5 col">История операций</div>
      <q-btn
        flat
        no-caps
        color="primary"
        icon="refresh"
        label="Обновить"
        :loading="loading"
        @click="load"
      />
    </div>

    <q-card class="mp-card q-mb-md">
      <q-card-section class="row q-col-gutter-sm items-end">
        <q-input v-model="coopname" label="Кооператив (coopname)" dense outlined class="col-12 col-sm-3" />
        <q-select
          v-model="processType"
          :options="processTypeOptions"
          label="Тип процесса"
          dense
          outlined
          emit-value
          map-options
          clearable
          class="col-12 col-sm-3"
        />
        <q-input
          v-model="username"
          label="Участник (account)"
          dense
          outlined
          clearable
          class="col-12 col-sm-3"
        />
        <q-btn
          color="primary"
          label="Загрузить"
          class="col-12 col-sm-3"
          :loading="loading"
          @click="load"
        />
      </q-card-section>
    </q-card>

    <q-table
      class="mp-card"
      :rows="page.items"
      :columns="columns"
      row-key="processHash"
      :loading="loading"
      flat
      bordered
      :pagination="pagination"
      :rows-per-page-options="[25, 50, 100]"
      @row-click="(_ev, row) => openDrawer(row)"
    >
      <template #body-cell-processType="props">
        <q-td :props="props">{{ humanProcessType(props.row.processType) }}</q-td>
      </template>
      <template #body-cell-firstSeenAt="props">
        <q-td :props="props">{{ formatDateTime(props.row.firstSeenAt) }}</q-td>
      </template>
      <template #body-cell-lastSeenAt="props">
        <q-td :props="props">{{ formatDateTime(props.row.lastSeenAt) }}</q-td>
      </template>
      <template #body-cell-processHash="props">
        <q-td :props="props" class="text-mono">{{ shortHash(props.row.processHash) }}</q-td>
      </template>
      <template #no-data>
        <div class="full-width text-center q-pa-md text-grey-7">
          Установите фильтры и нажмите «Загрузить».
        </div>
      </template>
    </q-table>

    <ProcessDetailsDrawer
      v-model="drawerOpen"
      :view="drawerView"
      :loading="drawerLoading"
    />
  </q-page>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import type { QTableProps } from 'quasar';
import { FailAlert } from 'src/shared/api';
import {
  getProcess,
  listProcesses,
  type IProcessesFilterInput,
  type ProcessesPageView,
  type ProcessSummaryView,
  type ProcessView,
} from '../api';
import ProcessDetailsDrawer from './ProcessDetailsDrawer.vue';

const coopname = ref<string>('');
const processType = ref<string | null>(null);
const username = ref<string | null>(null);
const loading = ref(false);
const page = ref<ProcessesPageView>({ items: [], totalCount: 0, totalPages: 0, currentPage: 1 });
const pagination = ref({ page: 1, rowsPerPage: 25, sortBy: 'lastSeenAt', descending: true });

const drawerOpen = ref(false);
const drawerLoading = ref(false);
const drawerView = ref<ProcessView | null>(null);

const processTypeOptions = [
  { label: 'Прямая поставка имущества (p.mkt.supply)', value: 'p.mkt.supply' },
  { label: 'Гарантийный возврат (p.mkt.return)', value: 'p.mkt.return' },
  { label: 'Утилизация скоропорта (p.mkt.wroff)', value: 'p.mkt.wroff' },
];

const columns: QTableProps['columns'] = [
  { name: 'processType', label: 'Процесс', field: 'processType', align: 'left', sortable: true },
  { name: 'username', label: 'Инициатор', field: 'username', align: 'left', sortable: true },
  { name: 'processHash', label: 'Идентификатор', field: 'processHash', align: 'left' },
  { name: 'firstSeenAt', label: 'Открыт', field: 'firstSeenAt', align: 'left', sortable: true },
  { name: 'lastSeenAt', label: 'Последнее событие', field: 'lastSeenAt', align: 'left', sortable: true },
];

const filter = computed<IProcessesFilterInput>(() => ({
  coopname: coopname.value.trim(),
  processType: processType.value ?? undefined,
  username: username.value?.trim() || undefined,
}));

async function load(): Promise<void> {
  if (!filter.value.coopname) return;
  loading.value = true;
  try {
    page.value = await listProcesses(filter.value, {
      page: pagination.value.page,
      limit: pagination.value.rowsPerPage,
    });
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить историю процессов');
  } finally {
    loading.value = false;
  }
}

async function openDrawer(row: ProcessSummaryView): Promise<void> {
  drawerOpen.value = true;
  drawerLoading.value = true;
  drawerView.value = null;
  try {
    drawerView.value = await getProcess(row.coopname, row.processHash);
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить контекст процесса');
    drawerOpen.value = false;
  } finally {
    drawerLoading.value = false;
  }
}

onMounted(() => {
  void load();
});

function humanProcessType(type: string | undefined): string {
  switch (type) {
    case 'p.mkt.supply':
      return 'Прямая поставка';
    case 'p.mkt.return':
      return 'Гарантийный возврат';
    case 'p.mkt.wroff':
      return 'Списание скоропорта';
    default:
      return type ?? '—';
  }
}

function shortHash(hash: string | undefined): string {
  if (!hash) return '—';
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function formatDateTime(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('ru-RU');
}
</script>

<style scoped>
.text-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
</style>
