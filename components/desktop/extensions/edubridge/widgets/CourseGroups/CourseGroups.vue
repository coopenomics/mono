<template lang="pug">
//- Группы курса — реестр: строка открывает правую панель с группой. Набор
//- идёт в группу, и деньги с занятиями считаются внутри неё.
BaseCard(variant="default" :title="$t('edubridge.courseGroups.title')")
  template(v-if="!readonly" #actions)
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
    template(#cell-starts_at="{ row }") {{ formatStart(row) }}
    template(#cell-learners_active="{ row }")
      span.t-num {{ row.learners_active }}
    template(#cell-lessons_held="{ row }")
      span.t-num {{ $t('edubridge.courseGroups.lessonsOf', { held: row.lessons_held, total: formatLessons(row.lessons_total) }) }}
    template(#cell-status="{ row }")
      BaseBadge(:variant="stateOf(row).variant") {{ stateOf(row).label }}
  .t-muted.t-sm(v-else) {{ $t('edubridge.courseGroups.empty') }}

  //- Группа целиком — в правой панели; та же группа открывается отдельной страницей кнопкой в шапке панели.
  DetailsDrawer(v-model="detailsOpen" :title="details?.title || $t('edubridge.courseGroups.title')" :width="560")
    template(v-if="details" #actions)
      BaseButton(variant="ghost" size="sm" :aria-label="$t('edubridge.courseGroups.openFullPageAriaLabel')" @click="openFullPage")
        template(#icon-left)
          q-icon(name="open_in_full" size="16px")
        | {{ $t('edubridge.courseGroups.openFullPageButton') }}
    GroupDetails(v-if="details" :course="course" :group="details" :readonly="readonly" @changed="replace" @reload="onGroupsChanged")

  //- Новая группа: условия берутся с курса на день открытия.
  BaseDialog(v-model="createOpen" :title="$t('edubridge.courseGroups.createTitle')" size="sm")
    BaseForm(:loading="busy" @submit="onCreate")
      .t-sm.t-muted.q-mb-md {{ $t('edubridge.courseGroups.createNote') }}
      BaseInput(v-model="createForm.title" :label="$t('edubridge.courseGroups.titleLabel')" :hint="$t('edubridge.courseGroups.titleHint')")
      BaseInput(v-model="createForm.starts_at" :label="$t('edubridge.courseGroups.startsAtLabel')" type="date" stack-label)
      BaseInput(v-if="timeScale.compressed.value" v-model="createForm.starts_in_minutes" :label="$t('edubridge.courseGroups.startsInMinutesLabel')" type="number" min="0" stack-label :hint="standHint")
      BaseSelect(v-if="platformGroupOptions.length" v-model="createForm.platform_group" :label="$t('edubridge.courseGroups.platformGroupLabel')" :options="platformGroupOptions" :hint="$t('edubridge.courseGroups.platformGroupHint')")
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" :disabled="busy" @click="createOpen = false") {{ $t('common.action.cancel') }}
          BaseButton(variant="primary" type="submit" :loading="busy") {{ $t('edubridge.courseGroups.create') }}
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { asText } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { minutesOf, useTimeScale } from '../../shared/lib/timeScale';
import { BaseBadge, BaseButton, BaseCard, BaseDialog, BaseForm, BaseInput, BaseSelect, BaseTable, type BaseTableColumn } from 'src/shared/ui/base';
import { DetailsDrawer } from 'src/shared/ui/domain';
import { fetchPlatformCourses, type ICourse } from '../../entities/Course';
import { createGroup, fetchCourseGroups, type IGroup } from '../../entities/Group';
import { GroupDetails, groupStateOf } from '../GroupDetails';
import { t } from '../../i18n';

/**
 * Группы курса на странице администратора. Набор идёт в группу; у каждой свои
 * участники, занятия и учёт средств. Строка реестра открывает группу в правой
 * панели; кнопка в шапке панели открывает её отдельной страницей.
 */
const props = defineProps<{
  course: ICourse;
  /** Группы показаны на просмотр: без открытия новой группы и правки. */
  readonly?: boolean;
}>();
const emit = defineEmits<{ changed: [] }>();

const route = useRoute();
const router = useRouter();

const groups = ref<IGroup[]>([]);
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const busy = ref(false);

const columns: BaseTableColumn<IGroup>[] = [
  { key: 'title', label: t('edubridge.courseGroups.column.title') },
  { key: 'starts_at', label: t('edubridge.courseGroups.column.startsAt'), width: '120px', nowrap: true },
  { key: 'learners_active', label: t('edubridge.courseGroups.column.learners'), numeric: true, width: '110px', nowrap: true },
  { key: 'lessons_held', label: t('edubridge.courseGroups.column.lessons'), numeric: true, width: '110px', nowrap: true },
  { key: 'status', label: t('edubridge.courseGroups.column.status'), width: '150px', nowrap: true },
];

const stateOf = groupStateOf;
const formatDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString('ru-RU') : '______');
/** Начало занятий: дата; на стенде со сжатым временем — с часами и минутами. */
const formatStart = (g: IGroup) =>
  g.starts_at_time ? new Date(String(g.starts_at_time)).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : formatDate(g.starts_at);
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

// Группы площадки, привязанной к курсу: новая группа открывается с привязкой к одной из них.
const platformCourseId = computed(() => String(props.course.external_ref ?? '').split(':')[0]);
const platformGroups = ref<{ id: string; name: string }[]>([]);
const platformGroupOptions = computed(() => [
  { value: '', label: t('edubridge.courseGroups.platformGroupNone') },
  ...platformGroups.value.map((g) => ({ value: g.id, label: g.name })),
].slice(platformGroups.value.length ? 0 : 1));
const refOf = (platformGroup: string): string => (platformGroup ? `${platformCourseId.value}:${platformGroup}` : platformCourseId.value);

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

function openDetails(row: IGroup): void {
  detailsId.value = asText(row.id);
  detailsOpen.value = true;
}

/** Та же группа на отдельной странице: на всю ширину и со своим адресом. */
function openFullPage(): void {
  if (!details.value) return;
  void router.push({ name: 'edubridge-admin-group', params: { coopname: route.params.coopname, id: asText(props.course.id), groupId: asText(details.value.id) } });
}

function replace(group: IGroup): void {
  const i = groups.value.findIndex((g) => asText(g.id) === asText(group.id));
  if (i >= 0) groups.value[i] = group;
  else groups.value.push(group);
  emit('changed');
}

/** Состав групп изменился в панели (отмена по недобору) — реестр перечитывается. */
async function onGroupsChanged(): Promise<void> {
  await load();
  emit('changed');
}

const createOpen = ref(false);
const createForm = reactive({ title: '', starts_at: '', starts_in_minutes: '' as string | number, platform_group: '' });

function openCreate(): void {
  Object.assign(createForm, { title: '', starts_at: '', starts_in_minutes: '', platform_group: '' });
  createOpen.value = true;
}

async function onCreate(): Promise<void> {
  busy.value = true;
  try {
    replace(
      await createGroup({
        course_id: asText(props.course.id),
        title: createForm.title || null,
        ...startOf(createForm),
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
// Группы меняются набором, занятиями, взносами участников и допусками преподавателей — блок обновляется сам.
useLiveReload([EduLive.groups, EduLive.enrollments, EduLive.lessons, EduLive.assignments], load);
defineExpose({ reload: load });
</script>

