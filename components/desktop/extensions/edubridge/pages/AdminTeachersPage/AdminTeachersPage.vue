<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-teachers:banner-dismissed")
    | {{ $t('edubridge.adminTeachersPage.hint.line1') }}

  BaseTable(
    v-if="firstLoad || teachers.length"
    :columns="columns"
    :rows="teachers"
    row-key="username"
    :loading="firstLoad"
    :clickable-rows="true"
    min-width="840px"
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
    template(#cell-assignments="{ row }")
      span(v-if="row.assignments_active") {{ row.assignments_active }}
      span.t-muted(v-else) {{ $t('edubridge.adminTeachersPage.noCourses') }}
    template(#cell-signed_at="{ row }") {{ formatDate(row.signed_at) }}

  EmptyState(v-if="!firstLoad && !teachers.length" :title="$t('edubridge.adminTeachersPage.emptyTitle')" :body="$t('edubridge.adminTeachersPage.emptyBody')")
    template(#icon)
      q-icon(name="co_present" size="32px")

  //- Карточка преподавателя: кто он и что за ним закреплено. Назначения ведутся
  //- здесь же — отдельного реестра назначений нет, он читался в отрыве от людей.
  //- Та же карточка открывается отдельной страницей — кнопкой в шапке панели.
  DetailsDrawer(v-model="cardOpen" :title="current?.display_name || current?.username || $t('edubridge.adminTeachersPage.cardFallbackTitle')" :width="640")
    template(#actions)
      BaseButton(variant="ghost" size="sm" :aria-label="$t('edubridge.adminTeachersPage.openFullPageAriaLabel')" @click="openFullPage")
        template(#icon-left)
          q-icon(name="open_in_full" size="16px")
        | {{ $t('edubridge.adminTeachersPage.openFullPageButton') }}

    TeacherCard(v-if="current" :key="current.username" :teacher="current" @change="onTeacherChange" @refresh="reloadTeachers")
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { asDateInput } from 'src/shared/lib/utils';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert } from 'src/shared/api';
import { Avatar, BaseBadge, BaseButton, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { DetailsDrawer, PageHint } from 'src/shared/ui/domain';
import { CONTRACT_STATUS_LABELS, fetchTeachers, type ITeacher } from '../../entities/Teacher';
import { TeacherCard } from '../../widgets/TeacherCard';
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
const route = useRoute();
const router = useRouter();
const teachers = ref<ITeacher[]>([]);
// Признак включён с самого начала: до конца первой загрузки на экране каркас, а не «пусто».
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const cardOpen = ref(false);
const current = ref<ITeacher | null>(null);

// Номер договора — длинный ключ, в полосе он занимает место и ничего не решает:
// его читают внутри карточки, когда нужен именно он.
const columns: BaseTableColumn<ITeacher>[] = [
  { key: 'teacher', label: i18nT('edubridge.adminTeachersPage.column.teacher') },
  { key: 'contract_status', label: i18nT('edubridge.adminTeachersPage.column.contractStatus'), width: '210px' },
  { key: 'hourly_rate', label: i18nT('edubridge.adminTeachersPage.column.hourlyRate'), numeric: true, width: '150px', nowrap: true },
  { key: 'assignments', label: i18nT('edubridge.adminTeachersPage.column.assignments'), width: '130px', nowrap: true },
  { key: 'signed_at', label: i18nT('edubridge.adminTeachersPage.column.signedAt'), width: '130px', nowrap: true },
];

const contractStatusOf = (s: string) => CONTRACT_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const formatDate = (v: unknown) => {
  const input = asDateInput(v);
  return input ? new Date(input).toLocaleDateString('ru-RU') : '______';
};

async function load(): Promise<void> {
  loading.value = true;
  try {
    teachers.value = await fetchTeachers();
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function openCard(row: ITeacher): void {
  current.value = row;
  cardOpen.value = true;
}

function openFullPage(): void {
  if (!current.value) return;
  void router.push({ name: 'edubridge-admin-teacher', params: { coopname: route.params.coopname, username: current.value.username } });
}

/** Карточка поправила преподавателя на месте — строка списка получает то же. */
function onTeacherChange(updated: ITeacher): void {
  current.value = updated;
  teachers.value = teachers.value.map((t) => (t.username === updated.username ? updated : t));
}

/** Живое перечитывание: список и открытая карточка берут свежие данные. */
async function reloadTeachers(): Promise<void> {
  await load();
  const fresh = current.value && teachers.value.find((t) => t.username === current.value?.username);
  if (fresh) current.value = fresh;
}

// Живое обновление: договоры подписывает председатель, назначения меняют
// другие администраторы — стол узнаёт об этом по ленте изменений.
useLiveReload([EduLive.teacherContracts, EduLive.assignments], reloadTeachers);

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
</style>
