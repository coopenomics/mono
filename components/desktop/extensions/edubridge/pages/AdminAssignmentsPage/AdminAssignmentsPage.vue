<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-assignments:banner-dismissed")
    | Назначьте преподавателю курс, расписание, ожидаемый результат и период сдачи — он подпишет приложение к договору.
    | Ниже — взносы результатами работы: совет принимает решение в повестке, здесь можно отклонить с причиной.
  PageTabs.q-mb-sm(:tabs="tabs" :active-key="tab" @select="(t) => (tab = t.key)")
  .t-sm.t-muted.q-mb-md(v-if="tab === 'assignments'") Назначение появляется после кнопки «Новое назначение» и действует, когда приложение к договору подписали преподаватель и председатель совета.
  .t-sm.t-muted.q-mb-md(v-else) Взнос появляется, когда преподаватель подаёт результат работы по действующему назначению со своего стола; решение принимает совет в повестке, здесь — подпись акта и отклонение с причиной.

  template(v-if="tab === 'assignments'")
    BaseTable(v-if="loading || assignments.length" :columns="assignmentColumns" :rows="assignments" row-key="id" :loading="loading && !assignments.length" min-width="760px")
      template(#cell-teacher_username="{ row }")
        IdentityCell(:account-name="row.teacher_username" :full-name="teacherName(row.teacher_username)")
      template(#cell-period="{ row }") {{ row.period_from }} — {{ row.period_to }}
      template(#cell-status="{ row }")
        BaseBadge(:variant="assignmentStatusOf(row.status).variant") {{ assignmentStatusOf(row.status).label }}
      template(#cell-actions="{ row }")
        BaseButton(v-if="row.status !== 'closed'" variant="ghost" size="sm" @click="onClose(row)") Закрыть
    EmptyState(v-if="!loading && !assignments.length" title="Назначений нет" body="Добавьте назначение кнопкой в правом верхнем углу.")
      template(#icon)
        q-icon(name="assignment_ind" size="32px")

  template(v-else)
    BaseTable(v-if="loading || contributions.length" :columns="contributionColumns" :rows="contributions" row-key="id" :loading="loading && !contributions.length" min-width="860px")
      template(#cell-teacher_username="{ row }")
        IdentityCell(:account-name="row.teacher_username" :full-name="teacherName(row.teacher_username)")
      template(#cell-rid_type="{ row }") {{ ridType(row.rid_type) }}
      template(#cell-amount="{ row }") {{ formatAsset2Digits(row.amount) }}
      template(#cell-status="{ row }")
        BaseBadge(:variant="contributionStatusOf(row.status).variant") {{ contributionStatusOf(row.status).label }}
      template(#cell-actions="{ row }")
        .row.no-wrap.justify-end.q-gutter-xs
          BaseButton(v-if="row.status === Zeus.EduContributionStatus.ACT_SIGNED" variant="primary" size="sm" :loading="busyId === row.id" @click="onAccept(row)") Подписать акт
          BaseButton(v-if="canDecline(row)" variant="ghost" size="sm" @click="openDecline(row)") Отклонить
    EmptyState(v-if="!loading && !contributions.length" title="Взносов нет")
      template(#icon)
        q-icon(name="workspace_premium" size="32px")

  BaseDialog(v-model="createOpen" title="Новое назначение" size="md")
    BaseForm(:loading="busy" @submit="onCreate")
      BaseSelect(v-model="form.teacher_username" label="Преподаватель" :options="teacherOptions" hint="Пайщики с подписанным договором участия в хозяйственной деятельности" searchable required)
      BaseSelect(v-model="form.course_id" label="Курс" :options="courseOptions" required)
      BaseInput(v-model="form.schedule" label="Расписание")
      BaseInput(v-model="form.expected_result" label="Ожидаемый результат" type="textarea" :rows="2")
      .row.q-col-gutter-md
        .col-6
          BaseInput(v-model="form.period_from" label="Период с" type="date" stack-label required)
        .col-6
          BaseInput(v-model="form.period_to" label="Период по" type="date" stack-label required)
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" @click="createOpen = false") Отменить
          BaseButton(variant="primary" type="submit" :loading="busy") Назначить

  BaseDialog(v-model="declineOpen" title="Отклонить взнос" size="sm")
    BaseForm(:loading="busy" @submit="onDecline")
      BaseInput(v-model="declineReason" label="Причина" type="textarea" :rows="3" required)
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" @click="declineOpen = false") Отменить
          BaseButton(variant="danger" type="submit" :loading="busy") Отклонить
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useHeaderActions } from 'src/shared/hooks';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseDialog, BaseForm, BaseInput, BaseSelect, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { IdentityCell, PageHint } from 'src/shared/ui/domain';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
import { fetchCourses, fetchTeacherOptions, type ICourse, type ITeacherOption } from '../../entities/Course';
import {
  ASSIGNMENT_STATUS_LABELS,
  CONTRIBUTION_STATUS_LABELS,
  RID_TYPE_LABELS,
  acceptContributionAsChairman,
  closeAssignment,
  createAssignment,
  declineContribution,
  fetchAssignments,
  fetchContributions,
  type IAssignment,
  type IAssignmentInput,
  type IContribution,
} from '../../entities/Teacher';
import NewAssignmentHeaderButton from './NewAssignmentHeaderButton.vue';

const { registerAction } = useHeaderActions();
const tabs: PageTab[] = [
  { key: 'assignments', label: 'Назначения' },
  { key: 'contributions', label: 'Взносы РИД' },
];
const tab = ref('assignments');
const assignments = ref<IAssignment[]>([]);
const contributions = ref<IContribution[]>([]);
const courses = ref<ICourse[]>([]);
const teachers = ref<ITeacherOption[]>([]);
const loading = ref(false);
const busy = ref(false);
const busyId = ref<string | null>(null);
const createOpen = ref(false);
const declineOpen = ref(false);
const declineTarget = ref<IContribution | null>(null);
const declineReason = ref('');
const form = reactive<IAssignmentInput>({ teacher_username: '', course_id: '', schedule: '', expected_result: '', period_from: '', period_to: '' });

const assignmentColumns: BaseTableColumn<IAssignment>[] = [
  { key: 'teacher_username', label: 'Преподаватель', width: '220px' },
  { key: 'course_title', label: 'Курс' },
  { key: 'period', label: 'Период сдачи', width: '170px', nowrap: true },
  { key: 'status', label: 'Состояние', width: '170px' },
  { key: 'actions', label: '', align: 'right', width: '90px' },
];
const contributionColumns: BaseTableColumn<IContribution>[] = [
  { key: 'teacher_username', label: 'Преподаватель', width: '220px' },
  { key: 'rid_type', label: 'Тип', width: '150px' },
  { key: 'description', label: 'Описание' },
  { key: 'amount', label: 'Сумма', numeric: true, width: '120px', nowrap: true },
  { key: 'status', label: 'Состояние', width: '170px' },
  { key: 'actions', label: '', align: 'right', width: '120px' },
];
const courseOptions = computed(() => courses.value.map((c) => ({ value: c.id, label: `${c.title} · ${c.subject}, ${c.grade}` })));
const teacherOptions = computed(() => teachers.value.map((t) => ({ value: t.username, label: `${t.display_name || t.username} · договор № ${t.contract_number}` })));
// ФИО известны для преподавателей с договором; остальным показываем учётное имя.
const teacherName = (username: string) => teachers.value.find((t) => t.username === username)?.display_name || null;
const DECLINABLE = new Set<string>([Zeus.EduContributionStatus.SUBMITTED, Zeus.EduContributionStatus.COUNCIL_APPROVED, Zeus.EduContributionStatus.ACT_SIGNED]);
const canDecline = (c: IContribution) => DECLINABLE.has(c.status);
const assignmentStatusOf = (s: string) => ASSIGNMENT_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const contributionStatusOf = (s: string) => CONTRIBUTION_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const ridType = (t: string) => RID_TYPE_LABELS[t] ?? t;

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [a, c, k, t] = await Promise.all([
      fetchAssignments(),
      fetchContributions(),
      fetchCourses({ options: { page: 1, limit: 200, sortBy: 'sort_order', sortOrder: 'ASC' } }),
      fetchTeacherOptions(),
    ]);
    assignments.value = a;
    contributions.value = c;
    courses.value = k.items;
    teachers.value = t;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}
async function onCreate(): Promise<void> {
  busy.value = true;
  try {
    assignments.value.unshift(await createAssignment({ ...form }));
    createOpen.value = false;
    SuccessAlert('Назначение создано — преподаватель подпишет приложение');
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}
async function onClose(a: IAssignment): Promise<void> {
  try {
    const updated = await closeAssignment(a.id);
    assignments.value = assignments.value.map((x) => (x.id === updated.id ? { ...x, status: updated.status } : x));
  } catch (e) {
    FailAlert(e);
  }
}
async function onAccept(c: IContribution): Promise<void> {
  busyId.value = c.id;
  try {
    const updated = await acceptContributionAsChairman(c);
    contributions.value = contributions.value.map((x) => (x.id === updated.id ? updated : x));
    SuccessAlert('Акт подписан — взнос принят в паевой фонд');
  } catch (e) {
    FailAlert(e);
  } finally {
    busyId.value = null;
  }
}
function openDecline(c: IContribution): void {
  declineTarget.value = c;
  declineReason.value = '';
  declineOpen.value = true;
}
async function onDecline(): Promise<void> {
  if (!declineTarget.value) return;
  busy.value = true;
  try {
    const updated = await declineContribution(declineTarget.value.id, declineReason.value.trim());
    contributions.value = contributions.value.map((x) => (x.id === updated.id ? updated : x));
    declineOpen.value = false;
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}
onMounted(() => {
  registerAction({ id: 'edubridge:new-assignment', component: NewAssignmentHeaderButton, props: { onClick: () => (createOpen.value = true) } });
  void load();
});
</script>
