<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:teacher-contributions:banner-dismissed")
    | {{ $t('edubridge.teacherContributionsPage.hint.line1') }}
    | {{ $t('edubridge.teacherContributionsPage.hint.line2') }}
    | {{ $t('edubridge.teacherContributionsPage.hint.line3') }}
    | {{ $t('edubridge.teacherContributionsPage.hint.line4') }}

  BaseTable(v-if="loading || items.length" :columns="columns" :rows="items" row-key="id" :loading="firstLoad" min-width="900px")
    template(#cell-rid_type="{ row }") {{ ridType(row.rid_type) }}
    template(#cell-amount="{ row }") {{ formatAsset2Digits(row.amount) }}
    template(#cell-status="{ row }")
      BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
      .t-muted.t-sm(v-if="row.status === Zeus.EduContributionStatus.HELD && row.hold_until") {{ $t('edubridge.teacherContributionsPage.heldUntil', { date: formatDate(row.hold_until) }) }}
      .t-muted.t-sm(v-if="row.decline_reason") {{ row.decline_reason }}
    template(#cell-actions="{ row }")
      BaseButton(v-if="row.status === Zeus.EduContributionStatus.DRAFT" variant="primary" size="sm" :loading="busy === row.id" @click="onSubmit(row)") {{ $t('edubridge.teacherContributionsPage.submitMaterials') }}
      BaseButton(v-else-if="row.status === Zeus.EduContributionStatus.COUNCIL_APPROVED" variant="primary" size="sm" :loading="busy === row.id" @click="onSignAct(row)") {{ $t('edubridge.teacherContributionsPage.signAct') }}
  EmptyState(v-if="!firstLoad && !items.length" :title="$t('edubridge.teacherContributionsPage.emptyTitle')" :body="$t('edubridge.teacherContributionsPage.emptyBody')")
    template(#icon)
      q-icon(name="workspace_premium" size="32px")

</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { asText } from 'src/shared/lib/utils';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import {
  CONTRIBUTION_STATUS_LABELS,
  RID_TYPE_LABELS,
  fetchMyContributions,
  commitLessonMaterials,
  signAct,
  type IContribution,
} from '../../entities/Teacher';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { t as i18nT } from '../../i18n';

const items = ref<IContribution[]>([]);
const loading = ref(false);
const firstLoad = useFirstLoad(loading);
const busy = ref<string | null>(null);

const columns: BaseTableColumn<IContribution>[] = [
  { key: 'rid_type', label: i18nT('edubridge.teacherContributionsPage.columns.ridType'), width: '200px' },
  { key: 'description', label: i18nT('edubridge.teacherContributionsPage.columns.description') },
  { key: 'amount', label: i18nT('edubridge.teacherContributionsPage.columns.amount'), numeric: true, width: '140px' },
  { key: 'status', label: i18nT('edubridge.teacherContributionsPage.columns.status'), width: '220px' },
  { key: 'actions', label: '', align: 'right', width: '200px' },
];
const ridType = (type: string) => RID_TYPE_LABELS[type] ?? type;
const statusOf = (s: string) => CONTRIBUTION_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const formatDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString('ru-RU') : '______');

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = await fetchMyContributions();
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function replace(c: IContribution): void {
  const i = items.value.findIndex((x) => x.id === c.id);
  if (i >= 0) items.value[i] = c;
  else items.value.unshift(c);
}

async function onSubmit(c: IContribution): Promise<void> {
  busy.value = asText(c.id);
  try {
    replace(await commitLessonMaterials(c));
    SuccessAlert(i18nT('edubridge.teacherContributionsPage.materialsSubmittedSuccess'));
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = null;
  }
}

async function onSignAct(c: IContribution): Promise<void> {
  busy.value = asText(c.id);
  try {
    replace(await signAct(c));
    SuccessAlert(i18nT('edubridge.teacherContributionsPage.actSignedSuccess'));
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = null;
  }
}

// Живое обновление: данные меняются в цепи и на столах других участников.
useLiveReload([EduLive.contributions], load);

onMounted(load);
</script>
