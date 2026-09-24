<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-teachers:banner-dismissed")
    | {{ $t('edubridge.adminTeachersPage.hint.line1') }}
    | {{ $t('edubridge.adminTeachersPage.hint.line2') }}
    | {{ $t('edubridge.adminTeachersPage.hint.line3') }}

  BaseTable(
    v-if="loading || teachers.length"
    :columns="columns"
    :rows="teachers"
    row-key="username"
    :loading="firstLoad"
    :clickable-rows="true"
    min-width="620px"
    @row-click="openCard"
  )
    template(#cell-teacher="{ row }")
      .edu-teachers__person
        Avatar(:name="row.display_name || row.username" :src="row.avatar_url || undefined" size="sm")
        .edu-teachers__person-text
          .text-weight-medium.ellipsis {{ row.display_name || row.username }}
          .t-meta.t-muted.t-mono {{ row.username }}
    template(#cell-contract_status="{ row }")
      BaseBadge(:variant="contractStatusOf(row.contract_status).variant") {{ contractStatusOf(row.contract_status).label }}
    template(#cell-hourly_rate="{ row }") {{ formatAsset2Digits(row.hourly_rate) }}
    template(#cell-assignments="{ row }") {{ $t('edubridge.adminTeachersPage.assignmentsCount', { active: row.assignments_active, total: row.assignments_total }) }}
    template(#cell-signed_at="{ row }") {{ formatDate(row.signed_at) }}

  EmptyState(v-if="!firstLoad && !teachers.length" :title="$t('edubridge.adminTeachersPage.emptyTitle')" :body="$t('edubridge.adminTeachersPage.emptyBody')")
    template(#icon)
      q-icon(name="co_present" size="32px")

  //- Карточка преподавателя: кто он и что за ним закреплено. Назначения ведутся
  //- здесь же — отдельного реестра назначений нет, он читался в отрыве от людей.
  DetailsDrawer(v-model="cardOpen" :title="current?.display_name || current?.username || $t('edubridge.adminTeachersPage.cardFallbackTitle')" :width="640")
    template(v-if="current")
      .edu-teachers__head
        Avatar(:name="current.display_name || current.username" :src="current.avatar_url || undefined" size="xl")
        .edu-teachers__head-text
          .text-subtitle1.text-weight-medium {{ current.display_name || current.username }}
          AccountBadge(:account-name="current.username")
          BaseBadge.q-mt-xs(:variant="contractStatusOf(current.contract_status).variant") {{ contractStatusOf(current.contract_status).label }}

      //- Документы на подписи у председателя — здесь же, чтобы подписать, не
      //- уходя на стол председателя. Одобрение одно: решение здесь закрывает
      //- его и в «Запросах одобрений».
      .edu-teachers__approvals(v-if="approvals.length")
        .text-subtitle2.q-mb-xs {{ $t('edubridge.adminTeachersPage.approvalsTitle') }}
        .edu-teachers__approval(v-for="a in approvals" :key="a.approval_hash")
          div
            .t-sm.text-weight-medium {{ a.title }}
            .t-meta.t-muted {{ $t('edubridge.adminTeachersPage.approvalSentAt', { date: formatDate(a.created_at) }) }}
          ChairmanApprovalActions(:coopname="coopname" :approval-hash="a.approval_hash" :title="a.title" @decided="onApprovalDecided")

      PageTabs.q-mt-md(:tabs="tabs" :active-key="tab" @select="(t) => (tab = t.key)")

      template(v-if="tab === 'contract'")
        DataRow(:label="$t('edubridge.adminTeachersPage.contract.numberLabel')" :value="current.contract_number" mono copyable)
        //- Ставка часа в документы не попадает: она живёт в договоре расширения
        //- и правится в разделе «Экономика».
        DataRow(:label="$t('edubridge.adminTeachersPage.contract.hourlyRateLabel')" :value="formatAsset2Digits(current.hourly_rate)")
        DataRow(:label="$t('edubridge.adminTeachersPage.contract.signedByTeacherLabel')" :value="formatDate(current.signed_at)")
        DataRow(:label="$t('edubridge.adminTeachersPage.contract.signedByChairmanLabel')" :value="current.approved_at ? formatDate(current.approved_at) : '______'")
        DataRow(:label="$t('edubridge.adminTeachersPage.contract.assignmentsActiveLabel')" :value="String(current.assignments_active)")
        DataRow(:label="$t('edubridge.adminTeachersPage.contract.assignmentsTotalLabel')" :value="String(current.assignments_total)")

        //- Прекращение по соглашению сторон: основание уходит в цепь вместе с действием.
        template(v-if="current.contract_status === Zeus.EduContractStatus.ACTIVE")
          BaseButton.q-mt-md(v-if="!terminateFormOpen" variant="ghost" size="sm" @click="openTerminateForm") {{ $t('edubridge.adminTeachersPage.terminate.open') }}
          BaseForm.q-mt-md(v-else :loading="busy" @submit="onTerminate")
            BaseInput(v-model="terminateReason" :label="$t('edubridge.adminTeachersPage.terminate.reasonLabel')" type="textarea" :rows="2" required)
            template(#footer)
              .row.justify-end.q-gutter-sm
                BaseButton(variant="ghost" type="button" :disabled="busy" @click="terminateFormOpen = false") {{ $t('edubridge.adminTeachersPage.cancel') }}
                BaseButton(variant="danger" type="submit" :loading="busy") {{ $t('edubridge.adminTeachersPage.terminate.submit') }}

      template(v-else)
        q-list.q-mb-md(v-if="ownAssignments.length" separator)
          q-item(v-for="a in ownAssignments" :key="asText(a.id)")
            q-item-section
              .text-weight-medium {{ a.course_title }}
              .t-meta.t-muted {{ a.period_from }} — {{ a.period_to }}
              .t-meta.t-muted(v-if="a.schedule") {{ a.schedule }}
            q-item-section(side)
              .row.items-center.q-gutter-sm
                BaseBadge(:variant="assignmentStatusOf(a.status).variant") {{ assignmentStatusOf(a.status).label }}
                BaseButton(v-if="a.status !== Zeus.EduAssignmentStatus.CLOSED" variant="ghost" size="sm" @click="onClose(a)") {{ $t('edubridge.adminTeachersPage.assignment.close') }}
        .t-muted.t-sm.q-mb-md(v-else) {{ $t('edubridge.adminTeachersPage.assignment.empty') }}

        BaseButton(v-if="!assignFormOpen" variant="secondary" size="sm" @click="openAssignForm")
          template(#icon-left)
            q-icon(name="add" size="18px")
          | {{ $t('edubridge.adminTeachersPage.assignment.open') }}

        BaseForm(v-else :loading="busy" @submit="onCreate")
          BaseSelect(v-model="form.course_id" :label="$t('edubridge.adminTeachersPage.assignment.courseLabel')" :options="courseOptions" required)
          BaseInput(v-model="form.schedule" :label="$t('edubridge.adminTeachersPage.assignment.scheduleLabel')")
          BaseInput(v-model="form.expected_result" :label="$t('edubridge.adminTeachersPage.assignment.expectedResultLabel')" type="textarea" :rows="2")
          .row.q-col-gutter-md
            .col-6
              BaseInput(v-model="form.period_from" :label="$t('edubridge.adminTeachersPage.assignment.periodFromLabel')" type="date" stack-label required)
            .col-6
              BaseInput(v-model="form.period_to" :label="$t('edubridge.adminTeachersPage.assignment.periodToLabel')" type="date" stack-label required)
          template(#footer)
            .row.justify-end.q-gutter-sm
              BaseButton(variant="ghost" type="button" :disabled="busy" @click="assignFormOpen = false") {{ $t('edubridge.adminTeachersPage.cancel') }}
              BaseButton(variant="primary" type="submit" :loading="busy") {{ $t('edubridge.adminTeachersPage.assignment.submit') }}
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { asDateInput, asText } from 'src/shared/lib/utils';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { useConfirm, useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { Avatar, BaseBadge, BaseButton, BaseForm, BaseInput, BaseSelect, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { AccountBadge, DataRow, DetailsDrawer, PageHint } from 'src/shared/ui/domain';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
import { useSystemStore } from 'src/entities/System/model';
import { ChairmanApprovalActions } from 'src/features/ChairmanApproval';
import { refreshMenuBadges } from 'src/shared/lib/menuBadges';
import { courseSectionLabel, fetchCourses, type ICourse } from '../../entities/Course';
import {
  ASSIGNMENT_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  closeAssignment,
  createAssignment,
  fetchAssignments,
  fetchTeacherApprovals,
  fetchTeachers,
  terminateContract,
  type IAssignment,
  type IAssignmentInput,
  type ITeacher,
  type ITeacherApproval,
} from '../../entities/Teacher';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { t as i18nT } from '../../i18n';

/**
 * Преподаватели кооператива: список людей, а не список бумаг. В строке — имя с
 * фотографией, договор и сколько курсов за преподавателем закреплено; карточка
 * открывается справа и держит договор и назначения вместе, там же назначается
 * новый курс. Взносы результатами работы вынесены отдельной страницей: их
 * обрабатывают самостоятельно, а не заодно с назначениями.
 */
const teachers = ref<ITeacher[]>([]);
const assignments = ref<IAssignment[]>([]);
const courses = ref<ICourse[]>([]);
const loading = ref(false);
const firstLoad = useFirstLoad(loading);
const busy = ref(false);
const cardOpen = ref(false);
const current = ref<ITeacher | null>(null);
const approvals = ref<ITeacherApproval[]>([]);
const system = useSystemStore();
const coopname = computed(() => system.info?.coopname ?? '');
const tab = ref('contract');
const assignFormOpen = ref(false);
const terminateFormOpen = ref(false);
const terminateReason = ref('');
const { confirm } = useConfirm();

const tabs: PageTab[] = [
  { key: 'contract', label: i18nT('edubridge.adminTeachersPage.tab.contract') },
  { key: 'assignments', label: i18nT('edubridge.adminTeachersPage.tab.assignments') },
];

const form = reactive<IAssignmentInput>({ teacher_username: '', course_id: '', schedule: '', expected_result: '', period_from: '', period_to: '' });

// Номер договора — длинный ключ, в полосе он занимает место и ничего не решает:
// его читают внутри карточки, когда нужен именно он.
const columns: BaseTableColumn<ITeacher>[] = [
  { key: 'teacher', label: i18nT('edubridge.adminTeachersPage.column.teacher') },
  { key: 'contract_status', label: i18nT('edubridge.adminTeachersPage.column.contractStatus'), width: '210px' },
  { key: 'hourly_rate', label: i18nT('edubridge.adminTeachersPage.column.hourlyRate'), numeric: true, width: '150px', nowrap: true },
  { key: 'assignments', label: i18nT('edubridge.adminTeachersPage.column.assignments'), width: '130px', nowrap: true },
  { key: 'signed_at', label: i18nT('edubridge.adminTeachersPage.column.signedAt'), width: '130px', nowrap: true },
];

const courseOptions = computed(() => courses.value.map((c) => ({ value: asText(c.id), label: `${c.title} · ${courseSectionLabel(c.section_title, c.level_title, ', ')}` })));
const ownAssignments = computed(() => assignments.value.filter((a) => a.teacher_username === current.value?.username));

const contractStatusOf = (s: string) => CONTRACT_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const assignmentStatusOf = (s: string) => ASSIGNMENT_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const formatDate = (v: unknown) => {
  const input = asDateInput(v);
  return input ? new Date(input).toLocaleDateString('ru-RU') : '______';
};

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [t, a, c] = await Promise.all([
      fetchTeachers(),
      fetchAssignments(),
      fetchCourses({ options: { page: 1, limit: 200, sortBy: 'sort_order', sortOrder: 'ASC' } }),
    ]);
    teachers.value = t;
    assignments.value = a;
    courses.value = c.items;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

/** Документы преподавателя на подписи у председателя — при открытии карточки. */
async function loadApprovals(username: string): Promise<void> {
  approvals.value = [];
  try {
    approvals.value = await fetchTeacherApprovals(username);
  } catch (e) {
    FailAlert(e);
  }
}

/** Решение принято: цепь закрыла одобрение, перечитываем список и договор. */
async function onApprovalDecided(): Promise<void> {
  if (!current.value) return;
  const username = current.value.username;
  await Promise.all([loadApprovals(username), load(), refreshMenuBadges(['edubridge-admin-teachers'])]);
  const fresh = teachers.value.find((t) => t.username === username);
  if (fresh) current.value = fresh;
}

function openCard(row: ITeacher): void {
  current.value = row;
  void loadApprovals(row.username);
  tab.value = 'contract';
  assignFormOpen.value = false;
  terminateFormOpen.value = false;
  cardOpen.value = true;
}

function openAssignForm(): void {
  Object.assign(form, {
    teacher_username: current.value?.username ?? '',
    course_id: '',
    schedule: '',
    expected_result: '',
    period_from: '',
    period_to: '',
  });
  assignFormOpen.value = true;
}

async function onCreate(): Promise<void> {
  busy.value = true;
  try {
    const created = await createAssignment({ ...form });
    assignments.value = [created, ...assignments.value];
    bumpCounters(1);
    assignFormOpen.value = false;
    SuccessAlert(i18nT('edubridge.adminTeachersPage.assignment.created'));
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

async function onClose(a: IAssignment): Promise<void> {
  try {
    const updated = await closeAssignment(asText(a.id));
    assignments.value = assignments.value.map((x) => (x.id === updated.id ? { ...x, status: updated.status } : x));
    if (a.status === Zeus.EduAssignmentStatus.ACTIVE) bumpActive(-1);
  } catch (e) {
    FailAlert(e);
  }
}

function openTerminateForm(): void {
  terminateReason.value = '';
  terminateFormOpen.value = true;
}

/**
 * Договор прекращается, когда расчёт с преподавателем закрыт: действующие
 * назначения и незакрытые взносы сервер назовёт сам.
 */
async function onTerminate(): Promise<void> {
  if (!current.value) return;
  const ok = await confirm({
    title: i18nT('edubridge.adminTeachersPage.terminate.confirmTitle'),
    message: i18nT('edubridge.adminTeachersPage.terminate.confirmMessage'),
    confirmLabel: i18nT('edubridge.adminTeachersPage.terminate.confirmLabel'),
    danger: true,
  });
  if (!ok) return;
  busy.value = true;
  try {
    const contract = await terminateContract(current.value.username, terminateReason.value.trim());
    if (contract) patchCurrent((t) => ({ ...t, contract_status: contract.status }));
    terminateFormOpen.value = false;
    SuccessAlert(i18nT('edubridge.adminTeachersPage.terminate.success'));
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

/** Счётчики в строке считает сервер; после действия правим их на месте, не перечитывая список. */
function bumpCounters(delta: number): void {
  patchCurrent((t) => ({ ...t, assignments_total: t.assignments_total + delta }));
}
function bumpActive(delta: number): void {
  patchCurrent((t) => ({ ...t, assignments_active: Math.max(0, t.assignments_active + delta) }));
}
function patchCurrent(fn: (t: ITeacher) => ITeacher): void {
  if (!current.value) return;
  const updated = fn(current.value);
  current.value = updated;
  teachers.value = teachers.value.map((t) => (t.username === updated.username ? updated : t));
}

/** Живое перечитывание: список и открытая карточка берут свежие данные. */
async function reloadTeachers(): Promise<void> {
  await load();
  const fresh = current.value && teachers.value.find((t) => t.username === current.value?.username);
  if (fresh) current.value = fresh;
}

/** Одобрения открытой карточки — без очистки списка, чтобы он не мигал. */
async function refreshApprovals(): Promise<void> {
  const username = current.value?.username;
  if (username) approvals.value = await fetchTeacherApprovals(username);
}

// Живое обновление: договоры подписывает председатель, назначения и курсы
// меняют другие администраторы — стол узнаёт об этом по ленте изменений.
useLiveReload([EduLive.teacherContracts, EduLive.assignments, EduLive.courses], reloadTeachers);
useLiveReload([EduLive.approvals], refreshApprovals);

onMounted(load);
</script>

<style scoped>
.edu-teachers__person {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  min-width: 0;
}
.edu-teachers__person-text {
  min-width: 0;
}
.edu-teachers__approvals {
  margin-top: var(--p-4);
  padding: var(--p-3) var(--p-4);
  border-radius: var(--p-r-md);
  background: var(--p-warn-soft);
}
.edu-teachers__approval {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
  padding: var(--p-2) 0;
}
.edu-teachers__head {
  display: flex;
  align-items: center;
  gap: var(--p-3);
}
.edu-teachers__head-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-1);
  min-width: 0;
}
</style>
