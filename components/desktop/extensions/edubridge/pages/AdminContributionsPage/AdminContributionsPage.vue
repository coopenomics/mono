<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-contributions:banner-dismissed")
    | {{ $t('edubridge.adminContributionsPage.hint') }}

  BaseTable(v-if="loading || contributions.length" :columns="columns" :rows="contributions" row-key="id" :loading="firstLoad" min-width="920px")
    template(#cell-teacher_username="{ row }")
      IdentityCell(:account-name="row.teacher_username" :full-name="teacherName(row.teacher_username)")
    template(#cell-rid_type="{ row }") {{ ridType(row.rid_type) }}
    template(#cell-amount="{ row }") {{ formatAsset2Digits(row.amount) }}
    template(#cell-status="{ row }")
      BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
      //- Совет решения о приёме не принял: протокола не будет, материалы снимает председатель.
      .t-meta.text-negative(v-if="councilOutcome(row)") {{ councilOutcome(row) }}
    template(#cell-actions="{ row }")
      .row.no-wrap.justify-end.q-gutter-xs
        BaseButton(v-if="row.status === Zeus.EduContributionStatus.ACT_SIGNED" variant="primary" size="sm" :loading="busyId === row.id" @click="onAccept(row)") {{ $t('edubridge.adminContributionsPage.signActButton') }}
        BaseButton(v-if="row.status === Zeus.EduContributionStatus.HELD" variant="ghost" size="sm" @click="openRevoke(row)") {{ $t('edubridge.adminContributionsPage.revokeButton') }}
        BaseButton(v-if="canDecline(row)" variant="ghost" size="sm" @click="openDecline(row)") {{ $t('edubridge.adminContributionsPage.declineButton') }}

  EmptyState(v-if="!firstLoad && !contributions.length" :title="$t('edubridge.adminContributionsPage.emptyTitle')" :body="$t('edubridge.adminContributionsPage.emptyBody')")
    template(#icon)
      q-icon(name="workspace_premium" size="32px")

  //- Подтверждённая рекламация в гарантийный срок: заявление снимается до
  //- совета, материал остаётся за преподавателем.
  BaseDialog(v-model="revokeOpen" :title="$t('edubridge.adminContributionsPage.revokeDialogTitle')" size="sm")
    BaseForm(:loading="busy" @submit="onRevoke")
      BaseInput(v-model="revokeReason" :label="$t('edubridge.adminContributionsPage.revokeReasonLabel')" type="textarea" :rows="3" required)
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" @click="revokeOpen = false") {{ $t('edubridge.adminContributionsPage.cancel') }}
          BaseButton(variant="danger" type="submit" :loading="busy") {{ $t('edubridge.adminContributionsPage.revokeSubmit') }}

  BaseDialog(v-model="declineOpen" :title="$t('edubridge.adminContributionsPage.declineDialogTitle')" size="sm")
    BaseForm(:loading="busy" @submit="onDecline")
      BaseInput(v-model="declineReason" :label="$t('edubridge.adminContributionsPage.declineReasonLabel')" type="textarea" :rows="3" required)
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" @click="declineOpen = false") {{ $t('edubridge.adminContributionsPage.cancel') }}
          BaseButton(variant="danger" type="submit" :loading="busy") {{ $t('edubridge.adminContributionsPage.declineSubmit') }}
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { asText } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseDialog, BaseForm, BaseInput, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { IdentityCell, PageHint } from 'src/shared/ui/domain';
import {
  CONTRIBUTION_STATUS_LABELS,
  RID_TYPE_LABELS,
  acceptContributionAsChairman,
  declineContribution,
  fetchContributions,
  revokeContribution,
  fetchTeachers,
  type IContribution,
  type ITeacher,
} from '../../entities/Teacher';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { t as i18nT } from '../../i18n';

/**
 * Взносы результатами работы — отдельной страницей: председатель разбирает их
 * сам по себе, а не попутно с назначениями. Решение по взносу принимает совет
 * в повестке; здесь ставится вторая подпись на акте приёма-передачи и
 * оформляется отказ с причиной.
 */
const contributions = ref<IContribution[]>([]);
const teachers = ref<ITeacher[]>([]);
const loading = ref(false);
const firstLoad = useFirstLoad(loading);
const busy = ref(false);
const busyId = ref<string | null>(null);
const declineOpen = ref(false);
const declineTarget = ref<IContribution | null>(null);
const declineReason = ref('');
const revokeOpen = ref(false);
const revokeTarget = ref<IContribution | null>(null);
const revokeReason = ref('');

const columns: BaseTableColumn<IContribution>[] = [
  { key: 'teacher_username', label: i18nT('edubridge.adminContributionsPage.columnTeacher'), width: '240px' },
  { key: 'rid_type', label: i18nT('edubridge.adminContributionsPage.columnType'), width: '160px' },
  { key: 'description', label: i18nT('edubridge.adminContributionsPage.columnDescription') },
  { key: 'amount', label: i18nT('edubridge.adminContributionsPage.columnAmount'), numeric: true, width: '130px', nowrap: true },
  { key: 'status', label: i18nT('edubridge.adminContributionsPage.columnStatus'), width: '190px' },
  { key: 'actions', label: '', align: 'right', width: '200px' },
];

const DECLINABLE = new Set<string>([Zeus.EduContributionStatus.SUBMITTED, Zeus.EduContributionStatus.COUNCIL_APPROVED, Zeus.EduContributionStatus.ACT_SIGNED]);
const canDecline = (c: IContribution) => DECLINABLE.has(c.status);
const statusOf = (s: string) => CONTRIBUTION_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const ridType = (t: string) => RID_TYPE_LABELS[t] ?? t;
// ФИО известны по договору преподавателя; без него остаётся учётное имя.
const teacherName = (username: string) => teachers.value.find((t) => t.username === username)?.display_name || null;

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [c, t] = await Promise.all([fetchContributions(), fetchTeachers()]);
    contributions.value = c;
    teachers.value = t;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

async function onAccept(c: IContribution): Promise<void> {
  busyId.value = asText(c.id);
  try {
    const updated = await acceptContributionAsChairman(c);
    contributions.value = contributions.value.map((x) => (x.id === updated.id ? updated : x));
    SuccessAlert(i18nT('edubridge.adminContributionsPage.actSignedSuccess'));
  } catch (e) {
    FailAlert(e);
  } finally {
    busyId.value = null;
  }
}

function openRevoke(c: IContribution): void {
  revokeTarget.value = c;
  revokeReason.value = '';
  revokeOpen.value = true;
}

async function onRevoke(): Promise<void> {
  if (!revokeTarget.value) return;
  busy.value = true;
  try {
    const updated = await revokeContribution({ contribution_id: asText(revokeTarget.value.id), reason: revokeReason.value.trim() });
    contributions.value = contributions.value.map((x) => (x.id === updated.id ? updated : x));
    revokeOpen.value = false;
    SuccessAlert(i18nT('edubridge.adminContributionsPage.revokeSuccess'));
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

const COUNCIL_OUTCOME_LABELS: Record<string, string> = {
  [Zeus.EduCouncilOutcome.DECLINED]: i18nT('edubridge.adminContributionsPage.councilOutcome.DECLINED'),
  [Zeus.EduCouncilOutcome.EXPIRED]: i18nT('edubridge.adminContributionsPage.councilOutcome.EXPIRED'),
};
/** Пометка нужна, только пока взнос ждёт совета: после отклонения она уже сказана причиной. */
const councilOutcome = (c: IContribution) =>
  c.status === Zeus.EduContributionStatus.SUBMITTED && c.council_outcome ? COUNCIL_OUTCOME_LABELS[c.council_outcome] ?? '' : '';

function openDecline(c: IContribution): void {
  declineTarget.value = c;
  // Исход совета подставляется причиной — председатель может её уточнить.
  declineReason.value = councilOutcome(c);
  declineOpen.value = true;
}

async function onDecline(): Promise<void> {
  if (!declineTarget.value) return;
  busy.value = true;
  try {
    const updated = await declineContribution(asText(declineTarget.value.id), declineReason.value.trim());
    contributions.value = contributions.value.map((x) => (x.id === updated.id ? updated : x));
    declineOpen.value = false;
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

// Живое обновление: данные меняются в цепи и на столах других участников.
useLiveReload([EduLive.contributions, EduLive.teacherContracts], load);

onMounted(load);
</script>
