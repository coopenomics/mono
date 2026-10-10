<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-contributions:banner-dismissed")
    | {{ $t('edubridge.adminContributionsPage.hint') }}

  //- Строка открывает взнос в правой панели; действия доступны и в строке, и в панели.
  BaseTable(v-if="firstLoad || contributions.length" :columns="columns" :rows="contributions" row-key="id" :loading="firstLoad" :clickable-rows="true" min-width="980px" @row-click="openDetails")
    template(#cell-teacher_username="{ row }")
      IdentityCell(:account-name="row.teacher_username" :full-name="teacherName(row.teacher_username)")
    //- Взнос опознаётся названием результата, вид взноса — приглушённой строкой под ним.
    template(#cell-description="{ row }")
      .edu-contrib__title {{ row.description || '______' }}
      .t-muted.t-sm {{ ridType(row.rid_type) }}
    template(#cell-amount="{ row }")
      span.t-num {{ formatAsset2Digits(row.amount) }}
      //- Срез курса на дату занятия: по скольким участникам контракт провёл расчёт.
      .t-muted.t-sm(v-if="row.learners_count") {{ $t('edubridge.teacherLessonsPage.learnersLine', { count: row.learners_count }) }}
    template(#cell-status="{ row }")
      BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
      //- Совет решения о приёме не принял: протокола не будет, материалы снимает председатель.
      .t-meta.text-negative(v-if="councilOutcome(row)") {{ councilOutcome(row) }}
    template(#cell-actions="{ row }")
      .edu-row-actions
        BaseButton(v-if="canDecide && canDecline(row)" variant="secondary" size="sm" @click.stop="openDecline(row)") {{ $t('edubridge.adminContributionsPage.declineButton') }}

  EmptyState(v-if="!firstLoad && !contributions.length" :title="$t('edubridge.adminContributionsPage.emptyTitle')" :body="$t('edubridge.adminContributionsPage.emptyBody')")
    template(#icon)
      q-icon(name="workspace_premium" size="32px")

  //- Взнос целиком: состояние, сумма, материалы и документы цепи; решение — внизу панели.
  DetailsDrawer(v-model="detailsOpen" :title="details?.description || $t('edubridge.adminContributionsPage.columnDescription')" :width="560")
    template(v-if="details")
      ContributionDetails(:contribution="details" :teacher-name="teacherName(details.teacher_username)" show-teacher)
      .t-sm.text-negative.q-mt-md(v-if="councilOutcome(details)") {{ councilOutcome(details) }}
    //- Вторая подпись на акте — у председателя в «Запросах одобрений», здесь её нет.
    template(v-if="details && canDecide && canDecline(details)" #footer)
      .edu-row-actions
        BaseButton(v-if="canDecide && canDecline(details)" variant="secondary" @click="openDecline(details)") {{ $t('edubridge.adminContributionsPage.declineButton') }}

  BaseDialog(v-model="declineOpen" :title="$t('edubridge.adminContributionsPage.declineDialogTitle')" size="sm")
    BaseForm(:loading="busy" @submit="onDecline")
      BaseInput(v-model="declineReason" :label="$t('edubridge.adminContributionsPage.declineReasonLabel')" type="textarea" :rows="3" required)
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" @click="declineOpen = false") {{ $t('edubridge.adminContributionsPage.cancel') }}
          BaseButton(variant="danger" type="submit" :loading="busy") {{ $t('edubridge.adminContributionsPage.declineSubmit') }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { asText } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseDialog, BaseForm, BaseInput, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { DetailsDrawer, IdentityCell, PageHint } from 'src/shared/ui/domain';
import { ContributionDetails } from '../../widgets/ContributionDetails';
import {
  CONTRIBUTION_STATUS_LABELS,
  RID_TYPE_LABELS,
  declineContribution,
  fetchContributions,
  fetchTeachers,
  type IContribution,
  type ITeacher,
} from '../../entities/Teacher';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { t as i18nT } from '../../i18n';
import { useEduRights } from '../../shared/lib/rights';

const { canDecide } = useEduRights();

/**
 * Взносы результатами работы — отдельной страницей: председатель разбирает их
 * сам по себе, а не попутно с назначениями. Решение по взносу принимает совет
 * в повестке, вторую подпись на акте председатель ставит в «Запросах
 * одобрений»; здесь — отказ в приёме по решению совета.
 */
const contributions = ref<IContribution[]>([]);
const teachers = ref<ITeacher[]>([]);
// Признак включён с самого начала: до конца первой загрузки на экране каркас, а не «пусто».
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const busy = ref(false);
const declineOpen = ref(false);
const declineTarget = ref<IContribution | null>(null);
const declineReason = ref('');
/** Взнос в правой панели — по идентификатору: после действия панель показывает свежее состояние. */
const detailsOpen = ref(false);
const detailsId = ref<string | null>(null);
const details = computed(() => contributions.value.find((c) => asText(c.id) === detailsId.value) ?? null);
function openDetails(row: IContribution): void {
  detailsId.value = asText(row.id);
  detailsOpen.value = true;
}

const columns: BaseTableColumn<IContribution>[] = [
  { key: 'teacher_username', label: i18nT('edubridge.adminContributionsPage.columnTeacher'), width: '210px' },
  { key: 'description', label: i18nT('edubridge.adminContributionsPage.columnDescription') },
  { key: 'amount', label: i18nT('edubridge.adminContributionsPage.columnAmount'), numeric: true, width: '120px', nowrap: true },
  { key: 'status', label: i18nT('edubridge.adminContributionsPage.columnStatus'), width: '250px', nowrap: true },
  { key: 'actions', label: '', align: 'right', width: '190px', nowrap: true },
];

const DECLINABLE = new Set<string>([Zeus.EduContributionStatus.SUBMITTED, Zeus.EduContributionStatus.COUNCIL_APPROVED, Zeus.EduContributionStatus.ACT_SIGNED]);
/** Отказ в приёме оформляется только по решению совета: вопрос рассмотрен — принят либо отклонён. */
const canDecline = (c: IContribution) => DECLINABLE.has(c.status) && Boolean(c.council_decision_id || c.council_outcome === Zeus.EduCouncilOutcome.DECLINED);
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

<style scoped>
.edu-contrib__title {
  font-weight: 600;
  color: var(--p-ink);
}
/* Действия в строке таблицы стоят в ряд с равным зазором и не переносятся. */
.edu-row-actions {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--p-2);
}
</style>
