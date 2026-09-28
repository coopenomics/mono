<template lang="pug">
.q-pa-md
  TableSkeleton(v-if='loading', :columns='skeletonColumns', :rows='3')
  //- страница моего участка — тот же виджет, что и у страницы участка из списка
  KuBranchDetailsWidget(v-else-if='myBraname', :braname='myBraname')
  EmptyState(
    v-else,
    :title='$t("ku.kuMyBranchPage.emptyTitle")',
    :body='$t("ku.kuMyBranchPage.emptyBody")'
  )
    template(#icon)
      q-icon(name='home_work', size='48px')
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useLiveReload } from 'src/shared/lib/realtime';
import { KU_LIVE_TABLES } from 'src/entities/Ku/model';
import { useAccountStore } from 'src/entities/Account/model';
import { useBranchStore } from 'src/entities/Branch/model';
import { findChairedBranch } from 'src/entities/Branch/lib';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { FailAlert } from 'src/shared/api';
import { EmptyState, TableSkeleton } from 'src/shared/ui/base';
import type { TableSkeletonColumn } from 'src/shared/ui/base';
import { KuBranchDetailsWidget } from 'src/widgets/Ku/BranchDetails';
import { t } from 'src/shared/i18n';

const skeletonColumns: TableSkeletonColumn[] = [
  { label: t('ku.kuMyBranchPage.column.branch') },
  { label: t('ku.kuMyBranchPage.column.chairman') },
  { label: t('ku.kuMyBranchPage.column.trustees') },
];

const account = useAccountStore();
const branchStore = useBranchStore();
const system = useSystemStore();
const session = useSessionStore();

const loading = ref(true);

// участок пайщика: выбранный для участия в общих собраниях (braname в аккаунте);
// председателю участка braname устанавливается автоматически при избрании,
// fallback по председательству — для участков, учреждённых до автопривязки
const myBraname = computed(() => {
  const selected = session.currentUserAccount?.participant_account?.braname;
  if (selected) return selected;
  return findChairedBranch(branchStore.publicBranches, session.username)?.braname ?? '';
});

// Свой участок живёт по ленте изменений: участки — здесь, прикрепление к
// участку — через учётную запись, которую держит сессия (userContextLive).
useLiveReload(KU_LIVE_TABLES, () =>
  branchStore.loadPublicBranches({ coopname: system.info.coopname }).catch((e) => console.warn('[ku] фоновое перечитывание не удалось', e)),
);

onMounted(async () => {
  loading.value = true;
  try {
    const [, refreshed] = await Promise.all([
      branchStore.loadPublicBranches({ coopname: system.info.coopname }),
      account.getAccount(session.username),
    ]);
    // свой аккаунт держит сессия — она источник истины для «моих» экранов
    if (refreshed) session.setCurrentUserAccount(refreshed);
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
});
</script>
