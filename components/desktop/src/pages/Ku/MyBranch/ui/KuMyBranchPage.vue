<template lang="pug">
.q-pa-md
  TableSkeleton(v-if='loading', :columns='skeletonColumns', :rows='3')
  template(v-else-if='myBraname')
    //- страница моего участка — тот же виджет, что и у страницы участка из списка
    KuBranchPageWidget(:braname='myBraname')
      //- Доверенность и договор председателя участка — после решения совета об учреждении.
      //- Видит только сам председатель участка; узел отдаёт их ему и совету.
      KuTrusteeDocumentsCard.q-mt-md(
        v-if='myBranch && isTrustee',
        ref='trusteeCard',
        :braname='myBraname',
        :branch-name='myBranchName'
      )
  EmptyState(
    v-else,
    :title='$t("ku.kuMyBranchPage.emptyTitle")',
    :body='$t("ku.kuMyBranchPage.emptyBody")'
  )
    template(#icon)
      q-icon(name='home_work', size='48px')
    //- Пайщик без участка: выбрать участок в реестре либо учредить новый собранием.
    template(#action)
      .row.justify-center.q-gutter-sm
        BaseButton(variant='secondary', @click='openRoute("ku-branches")') {{ $t('ku.kuMyBranchPage.emptyBranchesAction') }}
        BaseButton(variant='secondary', @click='openRoute("ku-meetings")') {{ $t('ku.kuMyBranchPage.emptyMeetingsAction') }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useLiveReload } from 'src/shared/lib/realtime';
import { KU_LIVE_TABLES } from 'src/entities/Ku/model';
import { useAccountStore } from 'src/entities/Account/model';
import { useBranchStore } from 'src/entities/Branch/model';
import { findChairedBranch } from 'src/entities/Branch/lib';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { FailAlert } from 'src/shared/api';
import { BaseButton, EmptyState, TableSkeleton } from 'src/shared/ui/base';
import type { TableSkeletonColumn } from 'src/shared/ui/base';
import { KuBranchPageWidget } from 'src/widgets/Ku/BranchPage';
import { KuTrusteeDocumentsCard } from 'src/features/Ku/TrusteeDocuments';
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
const router = useRouter();

function openRoute(name: 'ku-branches' | 'ku-meetings'): void {
  void router.push({ name, params: { coopname: system.info.coopname } });
}

// участок пайщика: выбранный для участия в общих собраниях (braname в аккаунте);
// председателю участка braname устанавливается автоматически при избрании,
// fallback по председательству — для участков, учреждённых до автопривязки
const myBraname = computed(() => {
  const selected = session.currentUserAccount?.participant_account?.braname;
  if (selected) return selected;
  return findChairedBranch(branchStore.publicBranches, session.username)?.braname ?? '';
});

const myBranch = computed(() =>
  branchStore.publicBranches.find((item: { braname?: string }) => item.braname === myBraname.value) as
    | { short_name?: string; full_name?: string; trustee_certificate?: { username?: string } }
    | undefined,
);
const myBranchName = computed(() => myBranch.value?.short_name || myBranch.value?.full_name || myBraname.value);
const isTrustee = computed(() => myBranch.value?.trustee_certificate?.username === session.username);
const trusteeCard = ref<InstanceType<typeof KuTrusteeDocumentsCard> | null>(null);

// Свой участок живёт по ленте изменений: участки — здесь, прикрепление к
// участку — через учётную запись, которую держит сессия (userContextLive).
useLiveReload(KU_LIVE_TABLES, () => {
  // встречная подпись председателя совета меняет состояние документов председателя участка
  trusteeCard.value?.reload();
  return branchStore.loadPublicBranches({ coopname: system.info.coopname }).catch((e) => console.warn('[ku] фоновое перечитывание не удалось', e));
});

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
