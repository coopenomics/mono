<template>
  <q-page padding>
    <div class="q-pa-md">
      <BaseBanner variant="info" class="q-mb-md">
        Пакеты вашего кооператива, опубликованные в каталоге приложений.
        Новые версии публикуются на странице «Опубликовать релиз» и проходят
        модерацию оператора каталога.
      </BaseBanner>

      <TableSkeleton
        v-if="loading && !packages.length"
        :columns="skeletonColumns"
        :rows="3"
      />

      <BaseBanner v-else-if="error" variant="neg" class="q-mb-md">
        {{ error }}
      </BaseBanner>

      <EmptyState
        v-else-if="!packages.length"
        title="Пакетов пока нет"
        body="Зарегистрируйте пакет и опубликуйте первый релиз на странице «Опубликовать релиз»."
      >
        <template #icon>
          <q-icon name="inventory_2" size="28px" />
        </template>
      </EmptyState>

      <div v-else class="table-wrap">
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>Пакет</th>
                <th>Активная версия</th>
                <th>Цена</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pkg in packages" :key="pkg.packageId">
                <td>
                  <div class="t-mono">{{ pkg.packageId }}</div>
                  <div class="t-sm t-muted">{{ pkg.title }}</div>
                </td>
                <td>
                  <span v-if="pkg.lastActiveVersion" class="t-mono">{{ pkg.lastActiveVersion }}</span>
                  <BaseBadge v-else variant="neutral">нет релиза</BaseBadge>
                </td>
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
const error = ref<string | null>(null);

const skeletonColumns: TableSkeletonColumn[] = [
  { label: 'Пакет' },
  { label: 'Активная версия', cell: 'badge' },
  { label: 'Цена', width: '120px' },
];

/**
 * «Мои» = пакеты, чей scope (@scope/name) или publisher совпадает с
 * аккаунтом кооператива текущей сессии.
 */
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
  error.value = null;
  try {
    allPackages.value = await extensionApi.loadAppsCatalogRemotePackages(1, 50);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
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
