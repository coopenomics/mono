<template>
  <q-page padding>
    <div class="q-pa-md">
      <BaseBanner variant="info" class="q-mb-md">
        Тарифы пакетов задаёт оператор каталога on-chain (почасовая ставка,
        план «default»). Здесь появится управление ставками ваших пакетов,
        когда каталог откроет операцию изменения тарифа разработчику.
      </BaseBanner>

      <TableSkeleton
        v-if="loading && !packages.length"
        :columns="skeletonColumns"
        :rows="3"
      />

      <EmptyState
        v-else-if="!packages.length"
        title="Тарифов пока нет"
        body="Опубликуйте пакет — каталог назначит ставку по плану «default»."
      >
        <template #icon>
          <q-icon name="currency_ruble" size="28px" />
        </template>
      </EmptyState>

      <div v-else class="table-wrap">
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>Пакет</th>
                <th>План</th>
                <th>Ставка</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pkg in packages" :key="pkg.packageId">
                <td><span class="t-mono">{{ pkg.packageId }}</span></td>
                <td><BaseBadge variant="neutral">default</BaseBadge></td>
                <td>{{ formatPrice(pkg.rubPerMonth) }} ₽/мес</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { BaseBadge, BaseBanner, EmptyState, TableSkeleton } from 'src/shared/ui/base';
import type { TableSkeletonColumn } from 'src/shared/ui/base/TableSkeleton/TableSkeleton.types';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { api as extensionApi } from 'src/entities/Extension/api';
import type { Queries } from '@coopenomics/sdk';

type RemotePackage = Queries.Extensions.AppsCatalogRemotePackages.IOutput[
  typeof Queries.Extensions.AppsCatalogRemotePackages.name
][number];

const session = useSessionStore();
const systemStore = useSystemStore();

const allPackages = ref<RemotePackage[]>([]);
const loading = ref(false);

const skeletonColumns: TableSkeletonColumn[] = [
  { label: 'Пакет' },
  { label: 'План', cell: 'badge' },
  { label: 'Ставка', width: '140px' },
];

const packages = computed(() => {
  const coopname = systemStore.info.coopname || session.username || '';
  if (!coopname) return allPackages.value;
  return allPackages.value.filter(
    (pkg) =>
      pkg.publisher === coopname || pkg.packageId.startsWith(`@${coopname}/`),
  );
});

function formatPrice(rub: number): string {
  return new Intl.NumberFormat('ru-RU').format(rub);
}

onMounted(async () => {
  loading.value = true;
  try {
    allPackages.value = await extensionApi.loadAppsCatalogRemotePackages(1, 50);
  } catch {
    allPackages.value = [];
  } finally {
    loading.value = false;
  }
});
</script>
<style scoped lang="scss">
.table-scroll {
  overflow-x: auto;
}
</style>
