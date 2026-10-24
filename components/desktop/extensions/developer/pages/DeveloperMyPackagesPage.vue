<template lang="pug">
q-page(padding)
  .q-pa-md
    BaseBanner.q-mb-md(variant='info')
      | {{ $t('developer.myPackages.intro') }}

    TableSkeleton(
      v-if='loading && !packages.length',
      :columns='skeletonColumns',
      :rows='3'
    )

    BaseBanner.q-mb-md(v-else-if='error', variant='neg')
      | {{ error }}

    EmptyState(
      v-else-if='!packages.length',
      :title="$t('developer.myPackages.emptyTitle')",
      :body="$t('developer.myPackages.emptyBody')"
    )
      template(#icon)
        q-icon(name='inventory_2', size='28px')

    .table-wrap(v-else)
      .table-scroll
        table.table
          thead
            tr
              th {{ $t('developer.column.package') }}
              th {{ $t('developer.column.activeVersion') }}
              th {{ $t('developer.column.price') }}
          tbody
            tr(v-for='pkg in packages', :key='pkg.packageId')
              td
                .t-mono {{ pkg.packageId }}
                .t-sm.t-muted {{ pkg.title }}
              td
                span.t-mono(v-if='pkg.lastActiveVersion') {{ pkg.lastActiveVersion }}
                BaseBadge(v-else, variant='neutral') {{ $t('developer.myPackages.noRelease') }}
              td {{ pkg.rubPerMonth == null ? $t('developer.priceNotSet') : $t('developer.perMonth', { amount: formatPrice(pkg.rubPerMonth) }) }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { BaseBadge, BaseBanner, EmptyState, TableSkeleton } from 'src/shared/ui/base';
import type { TableSkeletonColumn } from 'src/shared/ui/base/TableSkeleton/TableSkeleton.types';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { api as extensionApi } from 'src/entities/Extension/api';
import type { Queries } from '@coopenomics/sdk';
import { t } from '../i18n';

type RemotePackage = Queries.Extensions.AppsCatalogRemotePackages.IOutput[
  typeof Queries.Extensions.AppsCatalogRemotePackages.name
][number];

const session = useSessionStore();
const systemStore = useSystemStore();

const allPackages = ref<RemotePackage[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const skeletonColumns: TableSkeletonColumn[] = [
  { label: t('developer.column.package') },
  { label: t('developer.column.activeVersion'), cell: 'badge' },
  { label: t('developer.column.price'), width: '120px' },
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

// realtime: нет источника — пакеты живут во внешнем каталоге, лента цепи кооператива о них не сообщает.
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
