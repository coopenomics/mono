<template lang="pug">
//- Группы курса — реестр: строка открывает правую панель с группой. Набор
//- идёт в группу, и деньги с занятиями считаются внутри неё.
BaseCard(variant="default" :title="$t('edubridge.courseGroups.title')")
  template(#actions)
    BaseButton(variant="secondary" size="sm" @click="openCreate")
      template(#icon-left)
        q-icon(name="add" size="18px")
      | {{ $t('edubridge.courseGroups.create') }}
  BaseTable(
    v-if="firstLoad || groups.length"
    :columns="columns"
    :rows="groups"
    row-key="id"
    :loading="firstLoad"
    :clickable-rows="true"
    min-width="640px"
    @row-click="openDetails"
  )
    template(#cell-title="{ row }")
      .text-weight-medium {{ row.title }}
    template(#cell-starts_at="{ row }") {{ formatDate(row.starts_at) }}
    template(#cell-learners_active="{ row }")
      span.t-num {{ row.learners_active }}
    template(#cell-lessons_held="{ row }")
      span.t-num {{ $t('edubridge.courseGroups.lessonsOf', { held: row.lessons_held, total: row.lessons_total }) }}
    template(#cell-status="{ row }")
      BaseBadge(:variant="stateOf(row).variant") {{ stateOf(row).label }}
  .t-muted.t-sm(v-else) {{ $t('edubridge.courseGroups.empty') }}

  //- Группа целиком: условия закреплены на день открытия, правятся название, дата начала, набор и привязка к площадке.
  DetailsDrawer(v-model="detailsOpen" :title="details?.title || $t('edubridge.courseGroups.title')" :width="520")
    template(v-if="details")
      BaseBadge.q-mb-md(:variant="stateOf(details).variant") {{ stateOf(details).label }}
      DataRow(:label="$t('edubridge.courseGroups.feeMonth')" :value="formatAsset2Digits(details.fee_month)")
      DataRow(:label="$t('edubridge.courseGroups.plannedRate')" :value="formatAsset2Digits(details.planned_hourly_rate)")
      DataRow(:label="$t('edubridge.courseGroups.payMode')" :value="details.pay_per_learner ? $t('edubridge.adminCoursePage.payModePerLearner') : $t('edubridge.adminCoursePage.payModeFixed')")
      DataRow(:label="$t('edubridge.courseGroups.guarantee')" :value="`${details.guarantee_days} ${pluralizeDays(Number(details.guarantee_days))}`")
      DataRow(:label="$t('edubridge.courseGroups.learners')" :value="String(details.learners_active)")
      DataRow(:label="$t('edubridge.courseGroups.lessons')" :value="$t('edubridge.courseGroups.lessonsOf', { held: details.lessons_held, total: details.lessons_total })")
      DataRow(v-if="details.teacher_reserve_balance" :label="$t('edubridge.courseGroups.reserve')" :value="formatAsset2Digits(details.teacher_reserve_balance)")
      DataRow(v-if="details.teacher_settled_total" :label="$t('edubridge.courseGroups.settled')" :value="formatAsset2Digits(details.teacher_settled_total)")
      .t-sm.t-muted.q-mt-sm.q-mb-md {{ $t('edubridge.courseGroups.termsNote') }}

      BaseForm(v-if="details.status === Zeus.EduGroupStatus.ACTIVE" :loading="busy" @submit="onSave")
        BaseInput(v-model="form.title" :label="$t('edubridge.courseGroups.titleLabel')" required)
        BaseInput(v-model="form.starts_at" :label="$t('edubridge.courseGroups.startsAtLabel')" type="date" stack-label :disabled="details.lessons_held > 0" :hint="details.lessons_held > 0 ? $t('edubridge.courseGroups.startLockedHint') : ''")
        BaseSelect(v-if="platformGroupOptions.length" v-model="form.platform_group" :label="$t('edubridge.courseGroups.platformGroupLabel')" :options="platformGroupOptions" :hint="$t('edubridge.courseGroups.platformGroupHint')")
        BaseCheckbox(v-model="form.enrollment_open")
          | {{ $t('edubridge.courseGroups.enrollmentOpenCheckbox') }}
        template(#footer)
          .row.justify-end.q-gutter-sm
            BaseButton(variant="primary" type="submit" :loading="busy") {{ $t('common.action.save') }}
    template(v-if="details && details.status === Zeus.EduGroupStatus.ACTIVE" #footer)
      .edu-row-actions
        BaseButton(variant="secondary" @click="emit('select', asText(details.id))") {{ $t('edubridge.courseGroups.showEconomy') }}
        BaseButton(variant="secondary" :disabled="details.learners_active > 0" :loading="closing" @click="onClose") {{ $t('edubridge.courseGroups.close') }}

  //- Новая группа: условия берутся с курса на день открытия.
  BaseDialog(v-model="createOpen" :title="$t('edubridge.courseGroups.createTitle')" size="sm")
    BaseForm(:loading="busy" @submit="onCreate")
      .t-sm.t-muted.q-mb-md {{ $t('edubridge.courseGroups.createNote') }}
      BaseInput(v-model="createForm.title" :label="$t('edubridge.courseGroups.titleLabel')" :hint="$t('edubridge.courseGroups.titleHint')")
      BaseInput(v-model="createForm.starts_at" :label="$t('edubridge.courseGroups.startsAtLabel')" type="date" stack-label)
      BaseSelect(v-if="platformGroupOptions.length" v-model="createForm.platform_group" :label="$t('edubridge.courseGroups.platformGroupLabel')" :options="platformGroupOptions" :hint="$t('edubridge.courseGroups.platformGroupHint')")
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" :disabled="busy" @click="createOpen = false") {{ $t('common.action.cancel') }}
          BaseButton(variant="primary" type="submit" :loading="busy") {{ $t('edubridge.courseGroups.create') }}
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { asText, pluralizeDays } from 'src/shared/lib/utils';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { useConfirm, useFirstLoad } from 'src/shared/lib/composables';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { BaseBadge, BaseButton, BaseCard, BaseCheckbox, BaseDialog, BaseForm, BaseInput, BaseSelect, BaseTable, type BaseTableColumn } from 'src/shared/ui/base';
import { DataRow, DetailsDrawer } from 'src/shared/ui/domain';
import { fetchPlatformCourses, type ICourse } from '../../entities/Course';
import { closeGroup, createGroup, fetchCourseGroups, updateGroup, type IGroup } from '../../entities/Group';
import { t } from '../../i18n';

/**
 * Группы курса на странице администратора. Набор идёт в группу; у каждой свои
 * участники, занятия и учёт средств. Условия группы — снимок условий курса на
 * день открытия, поэтому здесь правятся только название, дата начала, набор и
 * привязка к группе площадки.
 */
const props = defineProps<{ course: ICourse }>();
const emit = defineEmits<{ select: [groupId: string]; changed: [] }>();

const { confirm } = useConfirm();
const groups = ref<IGroup[]>([]);
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const busy = ref(false);
const closing = ref(false);

const columns: BaseTableColumn<IGroup>[] = [
  { key: 'title', label: t('edubridge.courseGroups.column.title') },
  { key: 'starts_at', label: t('edubridge.courseGroups.column.startsAt'), width: '120px', nowrap: true },
  { key: 'learners_active', label: t('edubridge.courseGroups.column.learners'), numeric: true, width: '110px', nowrap: true },
  { key: 'lessons_held', label: t('edubridge.courseGroups.column.lessons'), numeric: true, width: '110px', nowrap: true },
  { key: 'status', label: t('edubridge.courseGroups.column.status'), width: '150px', nowrap: true },
];

const formatDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString('ru-RU') : '______');

/** Состояние группы словами: набор открыт, набор закрыт, завершена, отменена. */
function stateOf(g: IGroup): { label: string; variant: 'pos' | 'neutral' | 'warn' } {
  if (g.status === Zeus.EduGroupStatus.CLOSED) return { label: t('edubridge.courseGroups.state.closed'), variant: 'neutral' };
  if (g.status === Zeus.EduGroupStatus.CANCELLED) return { label: t('edubridge.courseGroups.state.cancelled'), variant: 'neutral' };
  return g.enrollment_open ? { label: t('edubridge.courseGroups.state.enrolling'), variant: 'pos' } : { label: t('edubridge.courseGroups.state.running'), variant: 'warn' };
}

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
    // Площадка не ответила — группа открывается с привязкой курса.
    platformGroups.value = [];
  }
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    groups.value = await fetchCourseGroups(asText(props.course.id));
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

const detailsOpen = ref(false);
const detailsId = ref<string | null>(null);
const details = computed(() => groups.value.find((g) => asText(g.id) === detailsId.value) ?? null);
const form = reactive({ title: '', starts_at: '', platform_group: '', enrollment_open: true });

function openDetails(row: IGroup): void {
  detailsId.value = asText(row.id);
  Object.assign(form, { title: row.title, starts_at: row.starts_at ?? '', platform_group: platformGroupOf(row.external_ref), enrollment_open: row.enrollment_open });
  detailsOpen.value = true;
}

function replace(group: IGroup): void {
  const i = groups.value.findIndex((g) => asText(g.id) === asText(group.id));
  if (i >= 0) groups.value[i] = group;
  else groups.value.push(group);
  emit('changed');
}

async function onSave(): Promise<void> {
  if (!details.value) return;
  busy.value = true;
  try {
    replace(
      await updateGroup({
        id: asText(details.value.id),
        title: form.title,
        // Дата начала закреплена после первого занятия — тогда она не отправляется.
        ...(details.value.lessons_held > 0 ? {} : { starts_at: form.starts_at || null }),
        ...(platformCourseId.value ? { external_ref: refOf(form.platform_group) } : {}),
        enrollment_open: form.enrollment_open,
      }),
    );
    SuccessAlert(t('edubridge.courseGroups.saved'));
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

async function onClose(): Promise<void> {
  if (!details.value) return;
  const agreed = await confirm({
    title: t('edubridge.courseGroups.closeConfirmTitle'),
    message: t('edubridge.courseGroups.closeConfirmMessage', { groupTitle: details.value.title }),
    confirmLabel: t('edubridge.courseGroups.close'),
  });
  if (!agreed) return;
  closing.value = true;
  try {
    replace(await closeGroup(asText(details.value.id)));
    detailsOpen.value = false;
  } catch (e) {
    FailAlert(e);
  } finally {
    closing.value = false;
  }
}

const createOpen = ref(false);
const createForm = reactive({ title: '', starts_at: '', platform_group: '' });

function openCreate(): void {
  Object.assign(createForm, { title: '', starts_at: '', platform_group: '' });
  createOpen.value = true;
}

async function onCreate(): Promise<void> {
  busy.value = true;
  try {
    replace(
      await createGroup({
        course_id: asText(props.course.id),
        title: createForm.title || null,
        starts_at: createForm.starts_at || null,
        ...(platformCourseId.value ? { external_ref: refOf(createForm.platform_group) } : {}),
      }),
    );
    createOpen.value = false;
    SuccessAlert(t('edubridge.courseGroups.created'));
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

watch(() => props.course.id, load);
onMounted(() => {
  void load();
  void loadPlatformGroups();
});
// Группы меняются набором, занятиями и взносами участников — блок обновляется сам.
useLiveReload([EduLive.groups, EduLive.enrollments, EduLive.lessons], load);
defineExpose({ reload: load });
</script>

<style scoped>
.edu-row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-space-2, 8px);
  justify-content: flex-end;
}
</style>
