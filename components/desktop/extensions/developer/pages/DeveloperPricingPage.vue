<template lang="pug">
q-page(padding)
  .q-pa-md
    BaseBanner.q-mb-md(variant='info')
      | {{ $t('developer.pricing.intro') }}

    TableSkeleton(
      v-if='loading && !packages.length',
      :columns='skeletonColumns',
      :rows='3'
    )

    EmptyState(
      v-else-if='!packages.length',
      :title="$t('developer.pricing.emptyTitle')",
      :body="$t('developer.pricing.emptyBody')"
    )
      template(#icon)
        q-icon(name='currency_ruble', size='28px')

    .table-wrap(v-else)
      .table-scroll
        table.table
          thead
            tr
              th {{ $t('developer.column.package') }}
              th {{ $t('developer.column.plan') }}
              th {{ $t('developer.column.rate') }}
          tbody
            tr(v-for='pkg in packages', :key='pkg.packageId')
              td
                span.t-mono {{ pkg.packageId }}
              td
                BaseBadge(variant='neutral') default
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

const skeletonColumns: TableSkeletonColumn[] = [
  { label: t('developer.column.package') },
  { label: t('developer.column.plan'), cell: 'badge' },
  { label: t('developer.column.rate'), width: '140px' },
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

// realtime: нет источника — тарифы живут во внешнем каталоге, лента цепи кооператива о них не сообщает.
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
