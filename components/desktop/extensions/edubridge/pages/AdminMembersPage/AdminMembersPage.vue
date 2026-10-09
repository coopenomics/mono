<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-members:banner-dismissed")
    | {{ $t('edubridge.adminMembersPage.hint.line1') }}

  BaseInput(v-model="search" :label="$t('edubridge.adminMembersPage.searchLabel')" type="search" clearable @update:model-value="debouncedLoad")

  BaseTable(
    v-if="firstLoad || rows.length"
    :columns="columns"
    :rows="rows"
    row-key="username"
    :loading="firstLoad"
    :clickable-rows="true"
    min-width="680px"
    @row-click="open"
  )
    template(#cell-member="{ row }")
      IdentityCell(:account-name="row.username" :full-name="row.display_name || null")
    template(#cell-access="{ row }")
      BaseBadge(v-if="row.attention_count" variant="neg") {{ $t('edubridge.adminMembersPage.access.stuck', { count: row.attention_count }) }}
      BaseBadge(v-else-if="row.active_enrollments" variant="pos") {{ $t('edubridge.adminMembersPage.access.granted') }}
      BaseBadge(v-else variant="neutral") {{ $t('edubridge.adminMembersPage.access.noEnrollments') }}
  EmptyState(v-if="!firstLoad && !rows.length" :title="search ? $t('edubridge.adminMembersPage.searchEmptyTitle') : $t('edubridge.adminMembersPage.emptyTitle')" :body="search ? $t('edubridge.adminMembersPage.searchEmptyBody') : $t('edubridge.adminMembersPage.emptyBody')")
    template(#icon)
      q-icon(name="groups" size="32px")

  DetailsDrawer(v-model="drawerOpen" :title="card ? (card.display_name || card.username) : ''" :width="720")
    template(v-if="card")
      .edu-member__section
        .edu-member__head
          .text-subtitle2 {{ $t('edubridge.adminMembersPage.card.memberTitle') }}
        DataRow(:label="$t('edubridge.adminMembersPage.card.usernameLabel')" :value="card.username" mono copyable)
        DataRow(:label="$t('edubridge.adminMembersPage.card.learnersLabel')" :value="card.learners.length")
        DataRow(:label="$t('edubridge.adminMembersPage.card.enrollmentsLabel')" :value="card.enrollments.length")

      .edu-member__section
        .edu-member__head
          .text-subtitle2 {{ $t('edubridge.adminMembersPage.card.learnersTitle') }}
        .t-sm.t-muted(v-if="!card.learners.length") {{ $t('edubridge.adminMembersPage.card.learnersEmpty') }}
        //- Адрес копируется одним нажатием: по нему обучающегося находят в кабинете школы.
        //- У обучающегося без подписок, которому выдавался доступ на площадке, аккаунт
        //- можно удалить в кабинете школы и отметить это здесь.
        template(v-for="l in card.learners" :key="asText(l.id)")
          DataRow(:label="l.display_name" :value="l.recipient_value ?? $t('edubridge.adminMembersPage.card.contactHidden')" mono :copyable="Boolean(l.recipient_value)")
          .edu-member__account(v-if="accountOf(l)?.removed_at")
            .t-sm.t-muted {{ $t('edubridge.adminMembersPage.account.removed', { date: formatDate(accountOf(l)?.removed_at ?? '') }) }}
          .edu-member__account(v-else-if="canMarkRemoved(l)")
            .t-sm.t-muted {{ $t('edubridge.adminMembersPage.account.noSubscriptions', { platforms: platformsOf(l) }) }}
            BaseButton(variant="secondary" size="sm" :loading="marking === asText(l.id)" @click="onMarkRemoved(l)") {{ $t('edubridge.adminMembersPage.account.markRemoved') }}

      .edu-member__section
        .edu-member__head
          .text-subtitle2 {{ $t('edubridge.adminMembersPage.card.enrollmentsTitle') }}
        .t-sm.t-muted(v-if="!card.enrollments.length") {{ $t('edubridge.adminMembersPage.card.enrollmentsEmpty') }}
        BaseTable(v-else :columns="enrollmentColumns" :rows="card.enrollments" row-key="id" min-width="635px")
          template(#cell-paid_until="{ row }") {{ row.paid_until ? formatDate(row.paid_until) : '______' }}
          template(#cell-access_state="{ row }")
            BaseBadge(:variant="accessOf(row.access_state).variant") {{ accessOf(row.access_state).label }}
          //- Подписка не закрылась при выходе пайщика: закрытие повторяется само, здесь — повтор сразу.
          template(#cell-actions="{ row }")
            .edu-row-actions(v-if="row.close_pending")
              BaseBadge(variant="neg") {{ $t('edubridge.adminMembersPage.closePending.badge') }}
                q-tooltip(v-if="row.close_error" max-width="320px") {{ row.close_error }}
              BaseButton(variant="secondary" size="sm" :loading="closing === asText(row.id)" @click="onRetryClose(row)") {{ $t('common.action.retry') }}

      //- Выдача доступа: обычные задачи повторяются сами, поэтому в списке
      //- показываются те, что встали и ждут человека, — и повторяются отсюда же.
      .edu-member__section
        .edu-member__head
          .text-subtitle2 {{ $t('edubridge.adminMembersPage.card.tasksTitle') }}
        .t-sm.t-muted(v-if="!card.tasks.length") {{ $t('edubridge.adminMembersPage.card.tasksEmpty') }}
        BaseTable(v-else :columns="taskColumns" :rows="card.tasks" row-key="id" min-width="720px")
          template(#cell-kind="{ row }") {{ kindOf(row.kind) }}
          //- Когда задача выполнена, а пока не выполнена — когда поставлена: одинаковые строки различаются по времени.
          template(#cell-when="{ row }")
            span.t-num {{ formatMoment(row.done_at ?? row.created_at) }}
          template(#cell-status="{ row }")
            BaseBadge(:variant="taskStatusOf(row.status).variant") {{ taskStatusOf(row.status).label }}
          template(#cell-actions="{ row }")
            BaseButton(v-if="needsHand(row)" variant="secondary" size="sm" :loading="retrying === asText(row.id)" @click="onRetry(row)") {{ $t('common.action.retry') }}
</template>

<script setup lang="ts">
import { refreshMenuBadges } from 'src/shared/lib/menuBadges';
import { onMounted, ref } from 'vue';
import { debounce } from 'quasar';
import { Zeus } from '@coopenomics/sdk';
import { asText } from 'src/shared/lib/utils';
import { useConfirm, useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseInput, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { DataRow, DetailsDrawer, IdentityCell, PageHint } from 'src/shared/ui/domain';
import { ACCESS_STATE_LABELS } from '../../entities/Learner';
import { TASK_KIND_LABELS, TASK_STATUS_LABELS, fetchMemberCard, fetchMembers, markLearnerRemoved, retryEnrollmentClose, retryTask, type IMemberCard, type IMemberRow } from '../../entities/Admin';
import { CARRIER_LABELS } from '../../entities/Course';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { t as i18nT } from '../../i18n';

/**
 * Ученики приложения: пайщик, который оформляет подписки, и его обучающиеся —
 * дети или он сам. Строка — ФИО и учётное имя (IdentityCell, как во всех
 * реестрах), счётчики и состояние выдачи; карточка открывается нажатием на
 * строку и держит обучающихся, подписки и выдачу доступа вместе.
 *
 * Отдельного реестра очереди выдачи нет: задачи повторяются сами, а застрявшие
 * видны красной меткой прямо здесь — администратору важен ученик, у которого
 * доступ не открылся, а не список задач в отрыве от людей.
 */
const search = ref('');
const rows = ref<IMemberRow[]>([]);
const card = ref<IMemberCard | null>(null);
// Признак включён с самого начала: до конца первой загрузки на экране каркас, а не «пусто».
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const drawerOpen = ref(false);
const retrying = ref<string | null>(null);
const closing = ref<string | null>(null);
const marking = ref<string | null>(null);
const { confirm } = useConfirm();

const columns: BaseTableColumn<IMemberRow>[] = [
  { key: 'member', label: i18nT('edubridge.adminMembersPage.column.member') },
  { key: 'learners_count', label: i18nT('edubridge.adminMembersPage.column.learnersCount'), numeric: true, width: '130px', sortable: true },
  // Сортировка по подпискам поднимает наверх учеников без подписок: их аккаунты на площадках можно удалить.
  { key: 'active_enrollments', label: i18nT('edubridge.adminMembersPage.column.activeEnrollments'), numeric: true, width: '130px', sortable: true },
  { key: 'access', label: i18nT('edubridge.adminMembersPage.column.access'), width: '170px' },
];
const enrollmentColumns: BaseTableColumn<IMemberCard['enrollments'][number]>[] = [
  { key: 'course_title', label: i18nT('edubridge.adminMembersPage.enrollmentColumn.courseTitle') },
  { key: 'paid_until', label: i18nT('edubridge.adminMembersPage.enrollmentColumn.paidUntil'), width: '135px', nowrap: true },
  { key: 'access_state', label: i18nT('edubridge.adminMembersPage.enrollmentColumn.accessState'), width: '150px' },
  { key: 'actions', label: '', align: 'right', width: '150px' },
];
const taskColumns: BaseTableColumn<IMemberCard['tasks'][number]>[] = [
  { key: 'kind', label: i18nT('edubridge.adminMembersPage.taskColumn.kind'), width: '100px' },
  { key: 'when', label: i18nT('edubridge.adminMembersPage.taskColumn.when'), width: '120px', nowrap: true },
  { key: 'status', label: i18nT('edubridge.adminMembersPage.taskColumn.status'), width: '180px' },
  { key: 'last_error', label: i18nT('edubridge.adminMembersPage.taskColumn.lastError') },
  { key: 'actions', label: '', align: 'right', width: '130px' },
];

/** Задача встала: сама больше не повторится, нужен человек. */
const NEEDS_HAND = new Set<string>([Zeus.EduAccessTaskStatus.NEEDS_ATTENTION, Zeus.EduAccessTaskStatus.FAILED]);
const needsHand = (t: IMemberCard['tasks'][number]) => NEEDS_HAND.has(t.status);
const accessOf = (s: string) => ACCESS_STATE_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const taskStatusOf = (s: string) => TASK_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const kindOf = (k: string) => TASK_KIND_LABELS[k] ?? k;
const formatDate = (v: string | Date) => new Date(v).toLocaleDateString('ru-RU');
/** День и время коротко: «09.10, 14:03». */
const formatMoment = (v: string | Date) => new Date(v).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

async function load(): Promise<void> {
  loading.value = true;
  try {
    rows.value = await fetchMembers(search.value || undefined);
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}
const debouncedLoad = debounce(load, 300);

async function open(row: IMemberRow): Promise<void> {
  try {
    card.value = await fetchMemberCard(row.username);
    drawerOpen.value = true;
  } catch (e) {
    FailAlert(e);
  }
}

type ILearnerRow = IMemberCard['learners'][number];
/** Аккаунт обучающегося на площадках — по нашим данным о выдаче доступа. */
const accountOf = (l: ILearnerRow) => card.value?.learner_accounts.find((a) => asText(a.learner_id) === asText(l.id));
/** Подписок нет, доступ на площадке выдавался, отметки ещё нет — аккаунт можно удалить в кабинете школы. */
const canMarkRemoved = (l: ILearnerRow): boolean => {
  const account = accountOf(l);
  return Boolean(account && !account.removed_at && account.active_enrollments === 0 && account.carriers.length);
};
const platformsOf = (l: ILearnerRow): string => (accountOf(l)?.carriers ?? []).map((c) => CARRIER_LABELS[c] ?? c).join(', ');

/** Администратор удалил аккаунт в кабинете школы и отмечает это; новая выдача доступа отметку снимет. */
async function onMarkRemoved(l: ILearnerRow): Promise<void> {
  const agreed = await confirm({
    title: i18nT('edubridge.adminMembersPage.account.confirmTitle'),
    message: i18nT('edubridge.adminMembersPage.account.confirmMessage', { name: l.display_name, platforms: platformsOf(l) }),
    confirmLabel: i18nT('edubridge.adminMembersPage.account.markRemoved'),
  });
  if (!agreed) return;
  const id = asText(l.id);
  marking.value = id;
  try {
    await markLearnerRemoved(id);
    if (card.value) card.value = await fetchMemberCard(card.value.username);
  } catch (e) {
    FailAlert(e);
  } finally {
    marking.value = null;
  }
}

/** Повтор закрытия подписки, не закрывшейся при выходе пайщика: возврат по ней ляжет на кошелёк программы. */
async function onRetryClose(enrollment: IMemberCard['enrollments'][number]): Promise<void> {
  const id = asText(enrollment.id);
  closing.value = id;
  try {
    await retryEnrollmentClose(id);
    SuccessAlert(i18nT('edubridge.adminMembersPage.closePending.success'));
    if (card.value) card.value = await fetchMemberCard(card.value.username);
    await load();
    void refreshMenuBadges(['edubridge-admin-registry']);
  } catch (e) {
    FailAlert(e);
  } finally {
    closing.value = null;
  }
}

/** Повтор выдачи: задача уходит в работу, карточка и метка в строке обновляются. */
async function onRetry(task: IMemberCard['tasks'][number]): Promise<void> {
  const id = asText(task.id);
  retrying.value = id;
  try {
    await retryTask(id);
    SuccessAlert(i18nT('edubridge.adminMembersPage.retrySuccess'));
    if (card.value) card.value = await fetchMemberCard(card.value.username);
    await load();
    void refreshMenuBadges(['edubridge-admin-registry']);
  } catch (e) {
    FailAlert(e);
  } finally {
    retrying.value = null;
  }
}

/** Живое перечитывание: список и открытая карточка — выдача доступа идёт в фоне. */
async function reloadMembers(): Promise<void> {
  await load();
  if (drawerOpen.value && card.value) card.value = await fetchMemberCard(card.value.username);
}

// Живое обновление: задачи выдачи доступа отрабатывают в фоне, записи и
// ученики меняются на столах пайщиков — реестр узнаёт об этом по ленте.
useLiveReload([EduLive.learners, EduLive.enrollments, EduLive.accessTasks], reloadMembers);

onMounted(load);
</script>

<style scoped>
.edu-member__section + .edu-member__section {
  margin-top: var(--p-5);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
/* Строка об аккаунте на площадке стоит под адресом обучающегося: пояснение слева, действие справа. */
.edu-member__account {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
  padding: var(--p-1) 0 var(--p-3);
}
.edu-member__head {
  margin-bottom: var(--p-2);
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
