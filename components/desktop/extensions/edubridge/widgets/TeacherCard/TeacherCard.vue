<template lang="pug">
.edu-teacher-card
  .edu-teacher-card__head
    Avatar(:name="teacher.display_name || teacher.username" :src="teacher.avatar_url || undefined" size="xl")
    .edu-teacher-card__head-text
      .text-subtitle1.text-weight-medium {{ teacher.display_name || teacher.username }}
      AccountBadge(:account-name="teacher.username")
      BaseBadge.q-mt-xs(:variant="contractStatusOf(teacher.contract_status).variant") {{ contractStatusOf(teacher.contract_status).label }}

  //- Что преподаватель рассказал о себе — по этому администратор судит, кого допускает к курсу.
  .edu-teacher-card__about(v-if="teacher.about")
    .t-eyebrow.q-mb-xs {{ $t('edubridge.adminTeachersPage.aboutTitle') }}
    .edu-teacher-card__about-text {{ teacher.about }}

  //- Документы на подписи у председателя — здесь же, чтобы подписать, не
  //- уходя на стол председателя. Одобрение одно: решение здесь закрывает
  //- его и в «Запросах одобрений».
  .edu-teacher-card__approvals(v-if="approvals.length")
    .text-subtitle2.q-mb-xs {{ $t('edubridge.adminTeachersPage.approvalsTitle') }}
    .edu-teacher-card__approval(v-for="a in approvals" :key="a.approval_hash")
      //- Документ раскрывается строкой, как на столе совета: председатель
      //- читает то, что подписывает. Без текста остаётся одно название.
      ComplexDocument(v-if="approvalDocuments[a.approval_hash]" :document="approvalDocuments[a.approval_hash]" collapsible)
      .t-sm.text-weight-medium(v-else) {{ a.title }}
      .edu-teacher-card__approval-foot
        .t-meta.t-muted {{ $t('edubridge.adminTeachersPage.approvalSentAt', { date: formatDate(a.created_at) }) }}
        ChairmanApprovalActions(:coopname="coopname" :approval-hash="a.approval_hash" :title="a.title" @decided="onApprovalDecided")

  PageTabs.q-mt-md(:tabs="tabs" :active-key="tab" @select="(t) => (tab = t.key)")

  template(v-if="tab === 'contract'")
    //- Сам договор — первой строкой вкладки, текст открывается по нажатию.
    ComplexDocument.q-mt-md.q-mb-sm(v-if="contractDocument" :document="contractDocument" collapsible)
    DataRow(:label="$t('edubridge.adminTeachersPage.contract.numberLabel')" :value="teacher.contract_number" mono copyable)
    //- Ставка часа в документы не попадает: она живёт в договоре расширения
    //- и правится администратором здесь же.
    DataRow(:label="$t('edubridge.adminTeachersPage.contract.hourlyRateLabel')")
      template(#value-override)
        .row.items-center.no-wrap.q-gutter-sm
          span {{ formatAsset2Digits(teacher.hourly_rate) }}
          BaseButton(variant="ghost" size="sm" icon-only :aria-label="$t('edubridge.adminTeachersPage.rate.edit')" @click="openRate")
            template(#icon-left)
              q-icon(name="edit" size="18px")
    DataRow(:label="$t('edubridge.adminTeachersPage.contract.signedByTeacherLabel')" :value="formatDate(teacher.signed_at)")
    DataRow(:label="$t('edubridge.adminTeachersPage.contract.signedByChairmanLabel')" :value="teacher.approved_at ? formatDate(teacher.approved_at) : '______'")
    DataRow(:label="$t('edubridge.adminTeachersPage.contract.assignmentsActiveLabel')" :value="String(teacher.assignments_active)")
    DataRow(:label="$t('edubridge.adminTeachersPage.contract.assignmentsTotalLabel')" :value="String(teacher.assignments_total)")

    //- Прекращение по соглашению сторон: основание уходит в цепь вместе с действием.
    //- Кнопка красная и заметная, а от случайного нажатия защищают три шага:
    //- она только открывает форму, форма требует основание, отправка
    //- спрашивает подтверждение.
    template(v-if="teacher.contract_status === Zeus.EduContractStatus.ACTIVE")
      BaseButton.q-mt-lg(v-if="!terminateFormOpen" variant="danger" @click="openTerminateForm")
        template(#icon-left)
          q-icon(name="block" size="18px")
        | {{ $t('edubridge.adminTeachersPage.terminate.open') }}
      BaseForm.q-mt-lg(v-else :loading="busy" @submit="onTerminate")
        BaseInput(v-model="terminateReason" :label="$t('edubridge.adminTeachersPage.terminate.reasonLabel')" type="textarea" :rows="2" required)
        template(#footer)
          .row.justify-end.q-gutter-sm
            BaseButton(variant="ghost" type="button" :disabled="busy" @click="terminateFormOpen = false") {{ $t('edubridge.adminTeachersPage.cancel') }}
            BaseButton(variant="danger" type="submit" :disabled="!terminateReason.trim()" :loading="busy") {{ $t('edubridge.adminTeachersPage.terminate.submit') }}

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

  BaseDialog(v-model="rateOpen" :title="$t('edubridge.adminTeachersPage.rate.dialogTitle')" size="sm")
    BaseForm(:loading="savingRate" @submit="onSaveRate")
      BaseInput(v-model="rate" :label="$t('edubridge.adminTeachersPage.rate.label')" type="number" :suffix="symbol" autofocus required)
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" :disabled="savingRate" @click="rateOpen = false") {{ $t('edubridge.adminTeachersPage.cancel') }}
          BaseButton(variant="primary" type="submit" :loading="savingRate") {{ $t('common.action.save') }}
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef } from 'vue';
import { EdubridgeContract } from 'cooptypes';
import { Zeus } from '@coopenomics/sdk';
import { asDateInput, asText, formatToAsset } from 'src/shared/lib/utils';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { useConfirm } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { Avatar, BaseBadge, BaseButton, BaseDialog, BaseForm, BaseInput, BaseSelect } from 'src/shared/ui/base';
import { AccountBadge, DataRow } from 'src/shared/ui/domain';
import { ComplexDocument } from 'src/shared/ui/ComplexDocument';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import type { IDocumentAggregate } from 'src/entities/Document/model';
import { ChairmanApprovalActions, findApprovalByHash } from 'src/features/ChairmanApproval';
import { refreshMenuBadges } from 'src/shared/lib/menuBadges';
import { useLiveReload } from 'src/shared/lib/realtime';
import { courseSectionLabel, fetchCourses, type ICourse } from '../../entities/Course';
import { setTeacherRate } from '../../entities/Economy';
import {
  ASSIGNMENT_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  closeAssignment,
  createAssignment,
  fetchAssignments,
  fetchTeacherApprovals,
  fetchTeacherContractDocument,
  terminateContract,
  type IAssignment,
  type IAssignmentInput,
  type ITeacher,
  type ITeacherApproval,
} from '../../entities/Teacher';
import { EduLive } from '../../shared/lib/live';
import { t as i18nT } from '../../i18n';

/**
 * Карточка преподавателя: кто он, его договор и назначения на курсы. Одна и та
 * же и в правой панели списка, и на отдельной странице. Самого преподавателя
 * карточка получает снаружи и о правках сообщает наверх: строка списка и
 * страница держат свою копию. Смену преподавателя владелец оформляет ключом —
 * вкладка, формы и документы тогда начинаются заново.
 */
const props = defineProps<{ teacher: ITeacher }>();
const emit = defineEmits<{
  /** Преподаватель после правки на месте: ставка, счётчики назначений, состояние договора. */
  change: [teacher: ITeacher];
  /** Решение председателя принято — владелец перечитывает преподавателя из сервера. */
  refresh: [];
}>();

const assignments = ref<IAssignment[]>([]);
const courses = ref<ICourse[]>([]);
const busy = ref(false);
const approvals = ref<ITeacherApproval[]>([]);
// Тексты документов на подписи, по хэшу одобрения. Агрегат документа глубоко
// вложен и только читается — глубокая реактивность ему не нужна.
const approvalDocuments = shallowRef<Record<string, IDocumentAggregate>>({});
const session = useSessionStore();
const system = useSystemStore();
const coopname = computed(() => system.info?.coopname ?? '');
const symbol = computed(() => system.governSymbol);
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

const courseOptions = computed(() => courses.value.map((c) => ({ value: asText(c.id), label: `${c.title} · ${courseSectionLabel(c.section_title, c.level_title, ', ')}` })));
const ownAssignments = computed(() => assignments.value.filter((a) => a.teacher_username === props.teacher.username));
// Договор на вкладке — подписанный документ из записи договора: он есть в любом
// состоянии. У договоров, подписанных до появления этого поля, документа в
// записи нет — тогда, пока договор на подписи, текст берётся из одобрения.
const storedContract = shallowRef<IDocumentAggregate | null>(null);
const contractDocument = computed(() => {
  if (storedContract.value) return storedContract.value;
  const approval = approvals.value.find((a) => a.action === EdubridgeContract.Actions.Apprvcontr.actionName);
  return approval ? approvalDocuments.value[approval.approval_hash] : undefined;
});

/** Ошибка загрузки текста карточку не ломает: реквизиты договора видны и без него. */
async function loadContractDocument(): Promise<void> {
  try {
    storedContract.value = await fetchTeacherContractDocument(props.teacher.username);
  } catch {
    storedContract.value = null;
  }
}

const contractStatusOf = (s: string) => CONTRACT_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const assignmentStatusOf = (s: string) => ASSIGNMENT_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const formatDate = (v: unknown) => {
  const input = asDateInput(v);
  return input ? new Date(input).toLocaleDateString('ru-RU') : '______';
};

/** Назначения и курсы для формы назначения. */
async function loadAssignments(): Promise<void> {
  const [a, c] = await Promise.all([fetchAssignments(), fetchCourses({ options: { page: 1, limit: 200, sortBy: 'sort_order', sortOrder: 'ASC' } })]);
  assignments.value = a;
  courses.value = c.items;
}

/** Документы преподавателя на подписи у председателя. */
async function loadApprovals(): Promise<void> {
  approvals.value = await fetchTeacherApprovals(props.teacher.username);
  void loadApprovalDocuments();
  void loadContractDocument();
}

/**
 * Тексты документов на подписи. Одобрение с документом отдаёт реестр
 * председателя, а он открыт только председателю и членам совета — остальным
 * строка остаётся с одним названием. Ошибка здесь не показывается: карточка
 * работает и без текста, а решение по документу принимается отдельной кнопкой.
 */
async function loadApprovalDocuments(): Promise<void> {
  if (!session.isChairman && !session.isMember) return;
  const missing = approvals.value.filter((a) => !approvalDocuments.value[a.approval_hash]);
  const found = await Promise.all(
    missing.map(async (a) => {
      try {
        return { hash: a.approval_hash, document: (await findApprovalByHash(coopname.value, a.approval_hash))?.document ?? null };
      } catch {
        return { hash: a.approval_hash, document: null };
      }
    }),
  );
  const next = { ...approvalDocuments.value };
  for (const { hash, document } of found) if (document) next[hash] = document;
  approvalDocuments.value = next;
}

/** Решение принято: цепь закрыла одобрение, перечитываем список и договор. */
async function onApprovalDecided(): Promise<void> {
  await Promise.all([loadApprovals(), refreshMenuBadges(['edubridge-admin-teachers'])]);
  emit('refresh');
}

function openAssignForm(): void {
  Object.assign(form, {
    teacher_username: props.teacher.username,
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
    // Допуск действует сразу — действующих назначений тоже стало больше.
    patch((t) => ({ ...t, assignments_total: t.assignments_total + 1, assignments_active: t.assignments_active + 1 }));
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
    if (a.status === Zeus.EduAssignmentStatus.ACTIVE) patch((t) => ({ ...t, assignments_active: Math.max(0, t.assignments_active - 1) }));
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
  const ok = await confirm({
    title: i18nT('edubridge.adminTeachersPage.terminate.confirmTitle'),
    message: i18nT('edubridge.adminTeachersPage.terminate.confirmMessage'),
    note: i18nT('edubridge.adminTeachersPage.terminate.confirmNote'),
    confirmLabel: i18nT('edubridge.adminTeachersPage.terminate.confirmLabel'),
    danger: true,
  });
  if (!ok) return;
  busy.value = true;
  try {
    const contract = await terminateContract(props.teacher.username, terminateReason.value.trim());
    if (contract) patch((t) => ({ ...t, contract_status: contract.status }));
    terminateFormOpen.value = false;
    SuccessAlert(i18nT('edubridge.adminTeachersPage.terminate.success'));
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

const rateOpen = ref(false);
const rate = ref('');
const savingRate = ref(false);

function openRate(): void {
  rate.value = String(parseFloat(props.teacher.hourly_rate ?? '') || '');
  rateOpen.value = true;
}

async function onSaveRate(): Promise<void> {
  savingRate.value = true;
  try {
    const hourly_rate = formatToAsset(String(rate.value).replace(',', '.'), symbol.value);
    await setTeacherRate({ username: props.teacher.username, hourly_rate });
    patch((t) => ({ ...t, hourly_rate }));
    rateOpen.value = false;
    SuccessAlert(i18nT('edubridge.adminTeachersPage.rate.saved'));
  } catch (e) {
    FailAlert(e);
  } finally {
    savingRate.value = false;
  }
}

/** Счётчики и ставку считает сервер; после действия правим их на месте, не перечитывая список. */
function patch(fn: (t: ITeacher) => ITeacher): void {
  emit('change', fn(props.teacher));
}

// Живое обновление: назначения и курсы меняют другие администраторы, одобрения
// закрывает председатель — карточка узнаёт об этом по ленте изменений. Самого
// преподавателя перечитывает владелец карточки.
useLiveReload([EduLive.assignments, EduLive.courses], loadAssignments);
useLiveReload([EduLive.approvals], loadApprovals);

onMounted(async () => {
  try {
    await Promise.all([loadAssignments(), loadApprovals()]);
  } catch (e) {
    FailAlert(e);
  }
});
</script>

<style scoped>
/* Вкладки внутри карточки: полоса без собственного фона и боковых полей —
   её серый фон рассчитан на положение под шапкой страницы. */
.edu-teacher-card :deep(.tabbar) {
  background: transparent;
  padding: 0;
}
.edu-teacher-card__about {
  margin-top: var(--p-4);
}
.edu-teacher-card__about-text {
  white-space: pre-wrap;
  font-size: var(--p-fs-body);
  line-height: 1.6;
}
.edu-teacher-card__approvals {
  margin-top: var(--p-4);
  padding: var(--p-3) var(--p-4);
  border-radius: var(--p-r-md);
  background: var(--p-warn-soft);
}
.edu-teacher-card__approval {
  padding: var(--p-2) 0;
}
.edu-teacher-card__approval-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
  margin-top: var(--p-2);
}
.edu-teacher-card__head {
  display: flex;
  align-items: center;
  gap: var(--p-3);
}
.edu-teacher-card__head-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-1);
  min-width: 0;
}
</style>
