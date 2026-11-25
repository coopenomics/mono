<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-contributions:banner-dismissed")
    | {{ $t('edubridge.adminContributionsPage.hint') }}

  //- Строка открывает взнос в правой панели. Решение принимает совет, вторая подпись на акте —
  //- в «Запросах одобрений». Действие председателя здесь одно: закрыть без приёма расчёт по
  //- взносу, возвращённому на доработку.
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
    template(#cell-learners_count="{ row }")
      span.t-num {{ row.learners_count ?? '______' }}
    template(#cell-status="{ row }")
      BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
      //- Совет решения о приёме не принял: исход виден под состоянием, пока обратный вызов контракта закрывает взнос.
      .t-meta.text-negative(v-if="councilOutcome(row)") {{ councilOutcome(row) }}

  EmptyState(v-if="!firstLoad && !contributions.length" :title="$t('edubridge.adminContributionsPage.emptyTitle')" :body="$t('edubridge.adminContributionsPage.emptyBody')")
    template(#icon)
      q-icon(name="workspace_premium" size="32px")

  //- Взнос целиком: состояние, сумма, материалы и документы цепи.
  DetailsDrawer(v-model="detailsOpen" :title="details?.description || $t('edubridge.adminContributionsPage.columnDescription')" :width="560")
    template(v-if="details")
      ContributionDetails(:contribution="details" :teacher-name="teacherName(details.teacher_username)" show-teacher)
      .t-sm.text-negative.q-mt-md(v-if="councilOutcome(details)") {{ councilOutcome(details) }}
    template(v-if="details && closable(details)" #footer)
      .row.justify-end
        BaseButton(variant="secondary" @click="openClose") {{ $t('edubridge.adminContributionsPage.close.button') }}

  //- Закрытие без приёма: взнос преподавателя из резерва переходит на кошелёк программы; основание обязательно.
  BaseDialog(v-model="closeOpen" :title="$t('edubridge.adminContributionsPage.close.title')" size="sm")
    .t-sm.q-mb-md {{ $t('edubridge.adminContributionsPage.close.body') }}
    BaseInput(v-model="closeReason" :label="$t('edubridge.adminContributionsPage.close.reasonLabel')" type="textarea" :rows="3" autofocus)
    template(#footer)
      BaseButton(variant="ghost" :disabled="closing" @click="closeOpen = false") {{ $t('edubridge.teacherLessonsPage.cancel') }}
      BaseButton(variant="primary" :disabled="!closeReason.trim()" :loading="closing" @click="onClose") {{ $t('edubridge.adminContributionsPage.close.button') }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { asText } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseDialog, BaseInput, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { DetailsDrawer, IdentityCell, PageHint } from 'src/shared/ui/domain';
import { ContributionDetails } from '../../widgets/ContributionDetails';
import {
  CONTRIBUTION_STATUS_LABELS,
  RID_TYPE_LABELS,
  closeContribution,
  fetchContributions,
  fetchTeachers,
  type IContribution,
  type ITeacher,
} from '../../entities/Teacher';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { useEduRights } from '../../shared/lib/rights';
import { t as i18nT } from '../../i18n';

/**
 * Взносы результатами работы — отдельной страницей: председатель видит их
 * сами по себе, а не попутно с назначениями. Решение по взносу принимает совет
 * в повестке; вторую подпись на акте председатель ставит в «Запросах
 * одобрений». Не принятый взнос возвращается преподавателю на доработку и
 * ждёт повторной подачи без срока; закрыть расчёт по нему без приёма может
 * только председатель — здесь, с основанием.
 */
const contributions = ref<IContribution[]>([]);
const teachers = ref<ITeacher[]>([]);
// Признак включён с самого начала: до конца первой загрузки на экране каркас, а не «пусто».
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
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
  { key: 'learners_count', label: i18nT('edubridge.adminContributionsPage.columnLearners'), numeric: true, width: '130px', nowrap: true },
  { key: 'amount', label: i18nT('edubridge.adminContributionsPage.columnAmount'), numeric: true, width: '140px', nowrap: true },
  { key: 'status', label: i18nT('edubridge.adminContributionsPage.columnStatus'), width: '260px', nowrap: true },
];

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

const { canDecide } = useEduRights();
/** Без приёма закрывается только взнос на доработке — и только председателем. */
const closable = (c: IContribution): boolean => canDecide.value && c.status === Zeus.EduContributionStatus.RETURNED;
const closeOpen = ref(false);
const closeReason = ref('');
const closing = ref(false);
function openClose(): void {
  closeReason.value = '';
  closeOpen.value = true;
}
async function onClose(): Promise<void> {
  if (!details.value) return;
  closing.value = true;
  try {
    const closed = await closeContribution({ contribution_id: asText(details.value.id), reason: closeReason.value.trim() });
    contributions.value = contributions.value.map((c) => (asText(c.id) === asText(closed.id) ? closed : c));
    closeOpen.value = false;
    SuccessAlert(i18nT('edubridge.adminContributionsPage.close.success'));
  } catch (e) {
    FailAlert(e);
  } finally {
    closing.value = false;
  }
}

const COUNCIL_OUTCOME_LABELS: Record<string, string> = {
  [Zeus.EduCouncilOutcome.DECLINED]: i18nT('edubridge.adminContributionsPage.councilOutcome.DECLINED'),
  [Zeus.EduCouncilOutcome.EXPIRED]: i18nT('edubridge.adminContributionsPage.councilOutcome.EXPIRED'),
};
/** Пометка нужна, только пока взнос на рассмотрении: после отказа она уже сказана причиной. */
const councilOutcome = (c: IContribution) =>
  c.status === Zeus.EduContributionStatus.SUBMITTED && c.council_outcome ? COUNCIL_OUTCOME_LABELS[c.council_outcome] ?? '' : '';

// Живое обновление: данные меняются в цепи и на столах других участников.
useLiveReload([EduLive.contributions, EduLive.teacherContracts], load);

onMounted(load);
</script>

<style scoped>
.edu-contrib__title {
  font-weight: 600;
  color: var(--p-ink);
}
</style>
