<template>
  <q-page class="mp-role-admin q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="text-h5 col">Сводный склад кооператива</div>
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

    <q-tabs
      v-model="tab"
      dense
      align="left"
      class="text-grey-7"
      active-color="primary"
      indicator-color="primary"
      narrow-indicator
    >
      <q-tab name="warehouse" label="Сводный склад" />
      <q-tab name="flow" label="Поток заказов и поставок" />
    </q-tabs>

    <q-separator />

    <q-tab-panels v-model="tab" animated keep-alive>
      <q-tab-panel name="warehouse" class="q-px-none">
        <div class="row q-col-gutter-md q-mb-md">
          <q-card class="mp-card col-12 col-sm-3">
            <q-card-section>
              <div class="text-caption text-grey-7">Активных позиций</div>
              <div class="text-h6">{{ summary.totalActive }}</div>
            </q-card-section>
          </q-card>
          <q-card class="mp-card col-12 col-sm-3">
            <q-card-section>
              <div class="text-caption text-grey-7">КУ с движением</div>
              <div class="text-h6">{{ summary.kuCount }}</div>
            </q-card-section>
          </q-card>
          <q-card class="mp-card col-12 col-sm-3">
            <q-card-section>
              <div class="text-caption text-grey-7">SKU в обороте</div>
              <div class="text-h6">{{ summary.skuCount }}</div>
            </q-card-section>
          </q-card>
          <q-card class="mp-card col-12 col-sm-3">
            <q-card-section>
              <div class="text-caption text-grey-7">Списано (накопительно)</div>
              <div class="text-h6">{{ summary.writtenOff }}</div>
            </q-card-section>
          </q-card>
        </div>

        <WarehouseSummaryGrid :rows="warehouseRows" />

        <div class="text-caption text-grey-7 q-mt-sm">
          Колонка «Остаток» = LABELED + RETURNED − WRITTEN_OFF (транзитный склад: ISSUED уже
          ушло пайщику и в остатке не учитывается).
        </div>
      </q-tab-panel>

      <q-tab-panel name="flow" class="q-px-none">
        <div class="row q-col-gutter-md q-mb-md">
          <q-card class="mp-card col-12 col-sm-3">
            <q-card-section>
              <div class="text-caption text-grey-7">Маркировок за период</div>
              <div class="text-h6">{{ flow.labeled }}</div>
            </q-card-section>
          </q-card>
          <q-card class="mp-card col-12 col-sm-3">
            <q-card-section>
              <div class="text-caption text-grey-7">Выдач пайщикам</div>
              <div class="text-h6">{{ flow.issued }}</div>
            </q-card-section>
          </q-card>
          <q-card class="mp-card col-12 col-sm-3">
            <q-card-section>
              <div class="text-caption text-grey-7">Возвратов на склад</div>
              <div class="text-h6">{{ flow.returned }}</div>
            </q-card-section>
          </q-card>
          <q-card class="mp-card col-12 col-sm-3">
            <q-card-section>
              <div class="text-caption text-grey-7">Списаний</div>
              <div class="text-h6">{{ flow.writtenOff }}</div>
            </q-card-section>
          </q-card>
        </div>

        <q-table
          class="mp-card"
          :rows="topProducts"
          :columns="topColumns"
          row-key="sku"
          flat
          bordered
          dense
          :pagination="{ rowsPerPage: 10 }"
          :rows-per-page-options="[10, 25, 50]"
          binary-state-sort
        >
          <template #top>
            <div class="text-subtitle1">Топ позиций по обороту</div>
          </template>
        </q-table>

        <div class="text-caption text-grey-7 q-mt-md">
          Графики динамики (orders_per_day / supplies_per_day / writeoffs_per_month)
          подключаются по AR37 SDK-подписки платформы. До их завершения отображаются
          табличные итоги по marketplace_inventory.
        </div>
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import type { QTableProps } from 'quasar';
import { FailAlert } from 'src/shared/api';
import {
  WarehouseSummaryGrid,
  type WarehouseRow,
} from 'src/widgets/Marketplace/WarehouseSummaryGrid';
import { listAllInventory, type MarketplaceInventoryItemView } from '../api';

const tab = ref<'warehouse' | 'flow'>('warehouse');
const items = ref<MarketplaceInventoryItemView[]>([]);
const loading = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = await listAllInventory({});
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить сводный склад');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});

interface BucketKey {
  ku: string;
  sku: string;
  title: string;
}

const summary = computed(() => {
  const kus = new Set<string>();
  const skus = new Set<string>();
  let active = 0;
  let writtenOff = 0;
  for (const row of items.value) {
    kus.add(row.braname);
    skus.add(row.product_name_snapshot);
    if (row.status === 'WRITTEN_OFF') writtenOff += row.quantity_per_label;
    else active += row.quantity_per_label;
  }
  return {
    totalActive: active,
    writtenOff,
    kuCount: kus.size,
    skuCount: skus.size,
  };
});

const warehouseRows = computed<WarehouseRow[]>(() => {
  const buckets = new Map<string, { key: BucketKey; in: number; out: number; balance: number }>();
  for (const row of items.value) {
    const k = `${row.braname}::${row.product_name_snapshot}`;
    const b = buckets.get(k) ?? {
      key: { ku: row.braname, sku: row.product_name_snapshot, title: row.product_name_snapshot },
      in: 0,
      out: 0,
      balance: 0,
    };
    const qty = row.quantity_per_label;
    if (row.status === 'LABELED' || row.status === 'RETURNED') {
      b.in += qty;
      b.balance += qty;
    } else if (row.status === 'ISSUED') {
      b.out += qty;
    } else if (row.status === 'WRITTEN_OFF') {
      b.in += qty;
      b.out += qty;
    }
    buckets.set(k, b);
  }
  return [...buckets.values()].map((b) => ({
    sku: b.key.sku,
    title: b.key.title,
    pvz: b.key.ku,
    incoming: b.in,
    outgoing: b.out,
    balance: b.balance,
    unit: 'шт',
  }));
});

const flow = computed(() => {
  let labeled = 0;
  let issued = 0;
  let returned = 0;
  let writtenOff = 0;
  for (const row of items.value) {
    const qty = row.quantity_per_label;
    if (row.status === 'LABELED') labeled += qty;
    if (row.status === 'ISSUED') issued += qty;
    if (row.status === 'RETURNED') returned += qty;
    if (row.status === 'WRITTEN_OFF') writtenOff += qty;
  }
  return { labeled, issued, returned, writtenOff };
});

const topProducts = computed(() => {
  const totals = new Map<string, { sku: string; turnover: number; ku: Set<string> }>();
  for (const row of items.value) {
    const entry =
      totals.get(row.product_name_snapshot) ??
      { sku: row.product_name_snapshot, turnover: 0, ku: new Set<string>() };
    entry.turnover += row.quantity_per_label;
    entry.ku.add(row.braname);
    totals.set(row.product_name_snapshot, entry);
  }
  return [...totals.values()]
    .map((e) => ({ sku: e.sku, turnover: e.turnover, ku_count: e.ku.size }))
    .sort((a, b) => b.turnover - a.turnover)
    .slice(0, 10);
});

const topColumns: QTableProps['columns'] = [
  { name: 'sku', label: 'Позиция', field: 'sku', align: 'left', sortable: true },
  { name: 'turnover', label: 'Оборот, ед.', field: 'turnover', align: 'right', sortable: true },
  { name: 'ku_count', label: 'КУ', field: 'ku_count', align: 'right', sortable: true },
];
</script>
