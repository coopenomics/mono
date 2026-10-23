<template lang="pug">
//- Группа целиком: условия закреплены на день открытия, правятся название,
//- дата начала, набор, привязка к площадке и расписание. В боковой панели
//- блоки идут столбцом; на странице группы — двумя колонками.
.edu-group(:class="{ 'edu-group--wide': wide }")
  section.edu-group__block
    BaseBadge.q-mb-md(:variant="state.variant") {{ state.label }}
    DataRow(:label="$t('edubridge.courseGroups.feeMonth')" :value="formatAsset2Digits(group.fee_month)" align="spread")
    DataRow(:label="$t('edubridge.courseGroups.plannedRate')" :value="formatAsset2Digits(group.planned_hourly_rate)" align="spread")
    DataRow(:label="$t('edubridge.courseGroups.payMode')" :value="group.pay_per_learner ? $t('edubridge.adminCoursePage.payModePerLearner') : $t('edubridge.adminCoursePage.payModeFixed')" align="spread")
    DataRow(:label="$t('edubridge.courseGroups.guarantee')" :value="`${group.guarantee_days} ${pluralizeDays(Number(group.guarantee_days))}`" align="spread")
    DataRow(:label="$t('edubridge.courseGroups.learners')" :value="String(group.learners_active)" align="spread")
    DataRow(:label="$t('edubridge.courseGroups.lessons')" :value="$t('edubridge.courseGroups.lessonsOf', { held: group.lessons_held, total: formatLessons(group.lessons_total) })" align="spread")
    DataRow(v-if="group.teacher_reserve_balance" :label="$t('edubridge.courseGroups.reserve')" :value="formatAsset2Digits(group.teacher_reserve_balance)" align="spread")
    DataRow(v-if="group.teacher_settled_total" :label="$t('edubridge.courseGroups.settled')" :value="formatAsset2Digits(group.teacher_settled_total)" align="spread")
    //- Месяц этой группы при нынешнем числе обучающихся.
    template(v-if="groupEconomy")
      .t-eyebrow.q-mt-lg.q-mb-xs {{ $t('edubridge.courseGroups.monthTitle') }}
      DataRow(:label="$t('edubridge.adminCoursePage.groupFeeLabel')" :value="formatAsset2Digits(groupEconomy.group_fee_month)" align="spread")
      DataRow(:label="$t('edubridge.adminCoursePage.groupTeachersLabel')" :value="formatAsset2Digits(groupEconomy.group_teachers_month)" align="spread")
      DataRow(:label="$t('edubridge.adminCoursePage.groupProgramLabel')" :value="formatAsset2Digits(groupEconomy.group_program_month)" align="spread")
    .t-sm.t-muted.q-mt-sm {{ $t('edubridge.courseGroups.termsNote') }}

    //- Действующих подписок нет, а группа идёт: преподаватель ещё отчитывается о занятиях.
    //- Отчитаны все занятия программы — группа завершится сама. Отчётов больше не будет — её завершает администратор.
    BaseBanner.q-mt-md(v-if="canFinish" variant="info")
      template(#icon)
        q-icon(name="pending_actions")
      | {{ group.settlement_pending > 0 ? $t('edubridge.courseGroups.finishNotePending', { count: group.settlement_pending }) : $t('edubridge.courseGroups.finishNote') }}
      template(#action)
        BaseButton(variant="secondary" size="sm" :loading="busy" @click="finishConfirm = true") {{ $t('edubridge.courseGroups.finish') }}

  section.edu-group__block(v-if="active")
    //- Расписание группы — окнами; из них и даты начала строится календарь занятий группы.
    .t-eyebrow.q-mb-xs {{ $t('edubridge.courseGroups.scheduleTitle') }}
    .t-sm.t-muted.q-mb-md {{ $t('edubridge.courseGroups.scheduleNote') }}
    //- У курса нет преподавателей — окна остаются без них, занятия отчитать некому.
    BaseBanner.q-mb-md(v-if="!teacherOptions.length" variant="warn")
      template(#icon)
        q-icon(name="person_off")
      | {{ $t('edubridge.courseGroups.noTeachersNote') }}
    ScheduleSlotsEditor(v-model="slots" :teacher-options="teacherOptions" :default-minutes="group.lesson_minutes" :symbol="symbol" :disabled="readonly")
    .row.justify-end.q-mt-md(v-if="!readonly")
      BaseButton(variant="secondary" size="sm" :loading="scheduleBusy" @click="onSaveSchedule") {{ $t('edubridge.courseGroups.saveSchedule') }}

    BaseForm.q-mt-lg(v-if="!readonly" :loading="busy" @submit="onSave")
      .t-eyebrow.q-mb-sm {{ $t('edubridge.courseGroups.settingsTitle') }}
      BaseInput(v-model="form.title" :label="$t('edubridge.courseGroups.titleLabel')" required)
      BaseInput(v-model="form.starts_at" :label="$t('edubridge.courseGroups.startsAtLabel')" type="date" stack-label :disabled="group.lessons_held > 0" :hint="group.lessons_held > 0 ? $t('edubridge.courseGroups.startLockedHint') : ''")
      BaseInput(v-if="timeScale.compressed.value && group.lessons_held === 0" v-model="form.starts_in_minutes" :label="$t('edubridge.courseGroups.startsInMinutesLabel')" type="number" min="0" stack-label :hint="standHint")
      BaseSelect(v-if="platformGroupOptions.length" v-model="form.platform_group" :label="$t('edubridge.courseGroups.platformGroupLabel')" :options="platformGroupOptions" :hint="$t('edubridge.courseGroups.platformGroupHint')")
      BaseCheckbox(v-model="form.enrollment_open")
        | {{ $t('edubridge.courseGroups.enrollmentOpenCheckbox') }}
      .t-sm.t-muted.q-mt-xs {{ $t('edubridge.courseGroups.enrollmentHint') }}
      template(#footer)
        .row.justify-end.q-gutter-sm
          //- Отмена по недобору — пока занятия группы не начались: подписки закрываются с возвратом на паевой.
          BaseButton(v-if="!groupStarted" variant="danger" type="button" :loading="cancelling" @click="onCancelUnderfilled") {{ $t('edubridge.courseGroups.cancelUnderfilled') }}
          BaseButton(variant="primary" type="submit" :loading="busy") {{ $t('common.action.save') }}

  BaseDialog(v-model="finishConfirm" :title="$t('edubridge.courseGroups.finishConfirmTitle')" size="md")
    .t-sm {{ $t('edubridge.courseGroups.finishConfirmText') }}
    template(#footer)
      .row.justify-end.q-gutter-sm
        BaseButton(variant="ghost" :disabled="busy" @click="finishConfirm = false") {{ $t('common.action.cancel') }}
        BaseButton(variant="danger" :loading="busy" @click="onFinish") {{ $t('edubridge.courseGroups.finish') }}
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { asText, formatToAsset, pluralizeDays } from 'src/shared/lib/utils';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { useConfirm } from 'src/shared/lib/composables';
import { useFioCache } from 'src/shared/lib/account/useFioCache';
import { useLiveReload } from 'src/shared/lib/realtime';
import { useSystemStore } from 'src/entities/System/model';
import { BaseBadge, BaseBanner, BaseButton, BaseCheckbox, BaseDialog, BaseForm, BaseInput, BaseSelect } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { fetchPlatformCourses, type ICourse } from '../../entities/Course';
import { fetchCourseEconomy, type ICourseEconomy } from '../../entities/Economy';
import { cancelGroupUnderfilled, finishGroup, setGroupSchedule, updateGroup, type IGroup } from '../../entities/Group';
import { fetchAssignments, type IAssignment } from '../../entities/Teacher';
import { type IScheduleSlot } from '../../entities/Lesson';
import { EduLive } from '../../shared/lib/live';
import { minutesOf, useTimeScale } from '../../shared/lib/timeScale';
import { ScheduleSlotsEditor } from '../ScheduleSlotsEditor';
import { groupStateOf } from './groupState';
import { t } from '../../i18n';

/**
 * Группа курса: сведения, экономика месяца, расписание и настройки. Один
 * виджет на боковую панель реестра групп и на страницу группы. Условия группы
 * — снимок условий курса на день открытия; здесь правятся название, дата
 * начала, набор, привязка к группе площадки и окна расписания.
 */
const props = defineProps<{
  course: ICourse;
  group: IGroup;
  /** Группа показана на просмотр: без правки. */
  readonly?: boolean;
  /** Страница группы: блоки двумя колонками. */
  wide?: boolean;
}>();
const emit = defineEmits<{
  /** Группа изменена — родитель подставляет её в свой список. */
  changed: [group: IGroup];
  /** Состав групп изменился (отмена по недобору) — родитель перечитывает список. */
  reload: [];
}>();

const busy = ref(false);
const state = computed(() => groupStateOf(props.group));
const active = computed(() => props.group.status === Zeus.EduGroupStatus.ACTIVE);
/** Занятий в программе — число по окнам недели на четыре недели месяца. */
const formatLessons = (value: unknown): string => Number(value || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 });

const timeScale = useTimeScale();
const standHint = computed(() =>
  t('edubridge.courseGroups.startsInMinutesHint', { day: Math.round(timeScale.daySeconds.value / 60), month: Math.round(timeScale.monthSeconds.value / 60) }),
);
/** Начало группы для сервера: минуты, названные на стенде, либо дата. */
const startOf = (f: { starts_at: string; starts_in_minutes: string | number }) => {
  const minutes = timeScale.compressed.value ? minutesOf(f.starts_in_minutes) : null;
  return minutes === null ? { starts_at: f.starts_at || null } : { starts_in_minutes: minutes };
};

// Группы площадки, привязанной к курсу: доступ участнику выдаётся в группу площадки его группы.
const platformCourseId = computed(() => String(props.course.external_ref ?? '').split(':')[0]);
const platformGroups = ref<{ id: string; name: string }[]>([]);
const platformGroupOptions = computed(() => [
  { value: '', label: t('edubridge.courseGroups.platformGroupNone') },
  ...platformGroups.value.map((g) => ({ value: g.id, label: g.name })),
].slice(platformGroups.value.length ? 0 : 1));
const refOf = (platformGroup: string): string => (platformGroup ? `${platformCourseId.value}:${platformGroup}` : platformCourseId.value);
const platformGroupOf = (externalRef: string): string => String(externalRef ?? '').split(':')[1] ?? '';

async function loadPlatformGroups(): Promise<void> {
  if (!platformCourseId.value) return;
  try {
    const courses = await fetchPlatformCourses(props.course.carrier);
    platformGroups.value = courses.find((c) => c.id === platformCourseId.value)?.groups ?? [];
  } catch {
    // Площадка не ответила — группа остаётся с привязкой курса.
    platformGroups.value = [];
  }
}

/** Экономика группы; пока не прочитана — блок не показывается. */
const groupEconomy = ref<ICourseEconomy | null>(null);
async function loadGroupEconomy(): Promise<void> {
  try {
    groupEconomy.value = await fetchCourseEconomy(asText(props.course.id), asText(props.group.id));
  } catch {
    groupEconomy.value = null;
  }
}

/** Окна расписания группы — правятся отдельно от названия и даты: сохранение перестраивает календарь. */
const slots = ref<IScheduleSlot[]>([]);
const scheduleBusy = ref(false);
const assignments = ref<IAssignment[]>([]);
const { fioCache, enrichFio } = useFioCache();
const system = useSystemStore();
const symbol = computed(() => system.governSymbol);
const form = reactive({ title: '', starts_at: '', starts_in_minutes: '' as string | number, platform_group: '', enrollment_open: true });

/** Допуски преподавателей к этому курсу: преподаватель окна выбирается из них. */
const teacherOptions = computed(() =>
  assignments.value
    .filter((a) => asText(a.course_id) === asText(props.course.id) && a.status === Zeus.EduAssignmentStatus.ACTIVE)
    .map((a) => ({ value: asText(a.id), label: fioCache.value.get(a.teacher_username) || a.teacher_username })),
);
async function loadAssignments(): Promise<void> {
  try {
    assignments.value = await fetchAssignments();
    void enrichFio(assignments.value.map((a) => a.teacher_username));
  } catch {
    assignments.value = [];
  }
}

const slotsOf = (g: IGroup): IScheduleSlot[] =>
  (g.schedule_slots ?? []).map((s) => ({ weekday: s.weekday, time: s.time, minutes: s.minutes, assignment_id: s.assignment_id ? String(s.assignment_id) : null, hourly_rate: s.hourly_rate ? String(parseFloat(s.hourly_rate)) : '' }));

/** Поля формы и окна — из группы: при открытии другой группы и после сохранения. */
function fill(g: IGroup): void {
  slots.value = slotsOf(g);
  Object.assign(form, { title: g.title, starts_at: g.starts_at ?? '', starts_in_minutes: '', platform_group: platformGroupOf(g.external_ref), enrollment_open: g.enrollment_open });
}

async function onSaveSchedule(): Promise<void> {
  scheduleBusy.value = true;
  try {
    const saved = await setGroupSchedule({
      group_id: asText(props.group.id),
      slots: slots.value.map((s) => ({ weekday: Number(s.weekday), time: s.time, minutes: Number(s.minutes), assignment_id: s.assignment_id || null, hourly_rate: formatToAsset(String(s.hourly_rate || '0').replace(',', '.'), symbol.value) })),
    });
    // Сервер расставляет преподавателей в окна без них — показываем сохранённое.
    slots.value = slotsOf(saved);
    emit('changed', saved);
    SuccessAlert(t('edubridge.courseGroups.scheduleSaved'));
  } catch (e) {
    FailAlert(e);
  } finally {
    scheduleBusy.value = false;
  }
}

const { confirm } = useConfirm();
const cancelling = ref(false);
/** Занятия группы начались: отмена по недобору закрыта, остаётся отказ участника от подписки. */
const groupStarted = computed(() => {
  const start = props.group.starts_at_time ?? props.group.starts_at;
  return Boolean(start) && new Date(String(start)) <= new Date();
});
async function onCancelUnderfilled(): Promise<void> {
  const agreed = await confirm({
    title: t('edubridge.courseGroups.cancelUnderfilledConfirmTitle'),
    message: t('edubridge.courseGroups.cancelUnderfilledConfirmMessage', { groupTitle: props.group.title }),
    note: t('edubridge.courseGroups.cancelUnderfilledConfirmNote'),
    confirmLabel: t('edubridge.courseGroups.cancelUnderfilled'),
    danger: true,
  });
  if (!agreed) return;
  cancelling.value = true;
  try {
    const count = await cancelGroupUnderfilled(asText(props.group.id));
    SuccessAlert(count > 0 ? t('edubridge.courseGroups.cancelledWithRefunds', { count }) : t('edubridge.courseGroups.cancelledNoSubscriptions'));
    emit('reload');
  } catch (e) {
    FailAlert(e);
  } finally {
    cancelling.value = false;
  }
}

const finishConfirm = ref(false);
/** Группу завершает администратор, когда занятия начались и действующих подписок в ней нет. */
const canFinish = computed(() => !props.readonly && active.value && props.group.learners_active === 0 && !props.group.enrollment_open);
/** Завершение группы: расчёты закрываются, резерв за занятия без отчёта уходит на кошелёк программы. */
async function onFinish(): Promise<void> {
  busy.value = true;
  try {
    emit('changed', await finishGroup(asText(props.group.id)));
    finishConfirm.value = false;
    SuccessAlert(t('edubridge.courseGroups.finished'));
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

async function onSave(): Promise<void> {
  busy.value = true;
  try {
    const saved = await updateGroup({
      id: asText(props.group.id),
      title: form.title,
      // Дата начала закреплена после первого занятия — тогда она не отправляется.
      ...(props.group.lessons_held > 0 ? {} : startOf(form)),
      ...(platformCourseId.value ? { external_ref: refOf(form.platform_group) } : {}),
      // Набор отправляется, когда его изменил администратор: иначе его ведёт дата начала.
      ...(form.enrollment_open === props.group.enrollment_open ? {} : { enrollment_open: form.enrollment_open }),
    });
    Object.assign(form, { enrollment_open: saved.enrollment_open, starts_at: saved.starts_at ?? '', starts_in_minutes: '' });
    emit('changed', saved);
    SuccessAlert(t('edubridge.courseGroups.saved'));
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

// Открыта другая группа — поля и экономика читаются заново.
watch(
  () => asText(props.group.id),
  () => {
    fill(props.group);
    groupEconomy.value = null;
    void loadGroupEconomy();
  },
  { immediate: true },
);

onMounted(() => {
  void loadPlatformGroups();
  void loadAssignments();
});
// Допуски к курсу меняют администраторы, взносы — участники: блок обновляется сам.
useLiveReload([EduLive.assignments], loadAssignments);
useLiveReload([EduLive.enrollments, EduLive.lessons], loadGroupEconomy);
</script>

<style scoped>
.edu-group {
  display: flex;
  flex-direction: column;
  gap: var(--p-6);
}
/* Страница группы: сведения слева узкой колонкой, расписание и настройки — справа. На узком экране блоки встают столбцом. */
.edu-group--wide {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(0, 2fr);
  gap: var(--p-7);
  align-items: start;
}
@media (max-width: 900px) {
  .edu-group--wide {
    grid-template-columns: minmax(0, 1fr);
  }
}
.edu-group__block {
  min-width: 0;
}
</style>
