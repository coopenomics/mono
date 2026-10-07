<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:member-learners:banner-dismissed")
    | {{ $t('edubridge.memberLearnersPage.hint.line1') }}

  BaseCard(variant="default")
    CardListSkeleton(v-if="firstLoad" :count="2")
    EmptyState(v-else-if="!learners.length" :title="$t('edubridge.memberLearnersPage.emptyTitle')" :body="$t('edubridge.memberLearnersPage.emptyBody')")
      template(#icon)
        q-icon(name="groups" size="32px")
    template(v-else)
      //- Строка целиком — вход в правую панель с данными обучающегося.
      .person.person--row.edu-learner(v-for="l in learners" :key="asText(l.id)" role="button" tabindex="0" @click="openLearner(l)" @keydown.enter="openLearner(l)")
        Avatar(:name="l.display_name" size="md" :tone="l.is_self ? 'primary' : 'neutral'")
        .person__main
          .person__name {{ l.display_name }}
          .person__meta {{ l.recipient_value }}
        .person__right
          .t-sm.t-muted(v-if="subscriptionsOf(l).length") {{ $t('edubridge.memberLearnersPage.subscriptionsCount', { n: subscriptionsOf(l).length }, subscriptionsOf(l).length) }}
          BaseChip(v-if="l.is_self" variant="neutral" size="sm") {{ $t('edubridge.memberLearnersPage.selfChip') }}
          q-icon.edu-learner__chevron(name="chevron_right" size="20px")

  //- Правая панель: сначала обучающийся и его подписки, правка — отдельным режимом той же панели.
  DetailsDrawer(v-model="drawerOpen" :title="drawerTitle" :width="520")
    template(v-if="mode === 'view' && current")
      .edu-learner__head
        Avatar(:name="current.display_name" size="xl" :tone="current.is_self ? 'primary' : 'neutral'")
        .edu-learner__head-text
          .text-subtitle1.text-weight-medium {{ current.display_name }}
          BaseChip(v-if="current.is_self" variant="neutral" size="sm") {{ $t('edubridge.memberLearnersPage.selfChip') }}
      DataRow(:label="$t('edubridge.learnerForm.recipientTypeLabel')" :value="recipientLabel(current.recipient_type)")
      DataRow(:label="recipientFieldLabel(current.recipient_type)" :value="current.recipient_value || '______'" copyable)
      DataRow(:label="$t('edubridge.memberLearnersPage.details.createdAt')" :value="formatDate(current.created_at)")

      //- На какие курсы записан: срок и состояние доступа; подробности — на странице подписок.
      .edu-learner__section
        .t-eyebrow.q-mb-sm {{ $t('edubridge.memberLearnersPage.details.subscriptions') }}
        q-list(v-if="subscriptionsOf(current).length" separator)
          q-item(v-for="e in subscriptionsOf(current)" :key="asText(e.id)")
            q-item-section
              .text-weight-medium {{ e.course_title }}
              .t-meta.t-muted {{ subscriptionMeta(e) }}
            q-item-section(side)
              .edu-learner__badges
                BaseBadge(:variant="statusOf(e.status).variant") {{ statusOf(e.status).label }}
                BaseBadge(:variant="accessOf(e.access_state).variant") {{ accessOf(e.access_state).label }}
        .t-muted.t-sm(v-else) {{ $t('edubridge.memberLearnersPage.details.noSubscriptions') }}

    LearnerForm(v-else-if="drawerOpen" :key="current ? asText(current.id) : 'new'" :learner="current" :default-self="!learners.length" :has-self="learners.some((l) => l.is_self)" @saved="onLearnerSaved" @cancel="onFormCancel")

    template(v-if="mode === 'view' && current" #footer)
      .edu-learner__footer
        BaseButton(variant="secondary" @click="mode = 'edit'")
          template(#icon-left)
            q-icon(name="edit" size="18px")
          | {{ $t('edubridge.memberLearnersPage.editAriaLabel') }}
        q-space
        BaseButton(variant="primary" @click="goToCatalog") {{ $t('edubridge.memberLearnersPage.details.enroll') }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { asDateInput, asText } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert } from 'src/shared/api';
import { useHeaderActions } from 'src/shared/hooks';
import { Avatar, BaseBadge, BaseButton, BaseCard, BaseChip, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { DataRow, DetailsDrawer, PageHint } from 'src/shared/ui/domain';
import {
  ACCESS_STATE_LABELS,
  ENROLLMENT_STATUS_LABELS,
  PERIOD_LABELS,
  RECIPIENT_LABELS,
  fetchMyEnrollments,
  fetchMyLearners,
  type IEnrollment,
  type ILearner,
} from '../../entities/Learner';
import { LearnerForm } from '../../widgets/LearnerForm';
import { HeaderActionButton } from '../../shared/ui/HeaderActionButton';
import { t } from '../../i18n';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';

/**
 * «Обучающиеся»: кто занимается и на какой адрес выдаётся доступ. Строка
 * открывает правую панель: адрес доступа и подписки обучающегося, оттуда же
 * правка. Курсы и сроки целиком живут на соседней странице «Мои подписки».
 */
const { registerAction } = useHeaderActions();
const route = useRoute();
const router = useRouter();

const learners = ref<ILearner[]>([]);
const enrollments = ref<IEnrollment[]>([]);
// Признак включён с самого начала: до конца первой загрузки на экране каркас, а не «пусто».
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const drawerOpen = ref(false);
const mode = ref<'view' | 'edit'>('view');
/** Обучающийся в панели — по идентификатору: после правки панель показывает свежее. */
const currentId = ref<string | null>(null);
const current = computed(() => learners.value.find((l) => asText(l.id) === currentId.value) ?? null);
const drawerTitle = computed(() => {
  if (mode.value === 'view') return current.value?.display_name ?? '';
  return current.value ? t('edubridge.memberLearnersPage.editDialogTitle') : t('edubridge.memberLearnersPage.newDialogTitle');
});

const subscriptionsOf = (l: ILearner) => enrollments.value.filter((e) => asText(e.learner_id) === asText(l.id));
const periodLabel = (p: string) => PERIOD_LABELS[p] ?? p;
/** Вторая строка подписки: период взноса и, если срок есть, до какого числа оплачено. */
const subscriptionMeta = (e: IEnrollment) =>
  [periodLabel(e.period), e.paid_until ? t('edubridge.memberLearnersPage.details.paidUntil', { date: formatDate(e.paid_until) }) : '']
    .filter(Boolean)
    .join(' · ');
const statusOf = (s: string) => ENROLLMENT_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const accessOf = (s: string) => ACCESS_STATE_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const recipientLabel = (k: string) => RECIPIENT_LABELS[k] ?? k;
/** Подпись адреса — по способу доступа: почта, Telegram или код пропуска. */
const recipientFieldLabel = (k: string) => t(`edubridge.learnerForm.recipientLabel.${k}`);
const formatDate = (v: unknown) => {
  const input = asDateInput(v);
  return input ? new Date(input).toLocaleDateString('ru-RU') : '______';
};

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [l, e] = await Promise.all([fetchMyLearners(), fetchMyEnrollments()]);
    learners.value = l;
    enrollments.value = e;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function addLearnerOpen(): void {
  currentId.value = null;
  mode.value = 'edit';
  drawerOpen.value = true;
}
function openLearner(l: ILearner): void {
  currentId.value = asText(l.id);
  mode.value = 'view';
  drawerOpen.value = true;
}
function onLearnerSaved(l: ILearner): void {
  const i = learners.value.findIndex((x) => x.id === l.id);
  if (i >= 0) learners.value[i] = l;
  else learners.value.push(l);
  currentId.value = asText(l.id);
  mode.value = 'view';
}
/** Отмена правки возвращает к просмотру; у нового обучающегося возвращаться некуда — панель закрывается. */
function onFormCancel(): void {
  if (current.value) mode.value = 'view';
  else drawerOpen.value = false;
}
function goToCatalog(): void {
  void router.push({ name: 'edubridge-catalog', params: { coopname: route.params.coopname } });
}

// Живое обновление: данные меняются в цепи и на столах других участников.
useLiveReload([EduLive.learners, EduLive.enrollments], load);

onMounted(async () => {
  registerAction({ id: 'edubridge:add-learner', component: HeaderActionButton, props: { label: t('edubridge.addLearnerHeaderButton.label'), icon: 'person_add', onClick: addLearnerOpen } });
  await load();
});
</script>

<style scoped>
.edu-learner {
  cursor: pointer;
  border-radius: var(--p-r-sm);
  transition: background var(--p-dur-fast, 120ms) ease;
}
.edu-learner:hover,
.edu-learner:focus-visible {
  background: var(--p-surface-2);
  outline: none;
}
.edu-learner__chevron {
  color: var(--p-ink-3);
}
.edu-learner__head {
  display: flex;
  align-items: center;
  gap: var(--p-3);
  margin-bottom: var(--p-4);
}
.edu-learner__head-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-1);
  min-width: 0;
}
.edu-learner__section {
  margin-top: var(--p-5);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
.edu-learner__badges {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--p-1);
}
.edu-learner__footer {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  width: 100%;
}
</style>
