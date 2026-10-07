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
      .person.person--row.edu-learner(v-for="l in learners" :key="asText(l.id)" role="button" tabindex="0" @click="editLearner(l)" @keydown.enter="editLearner(l)")
        Avatar(:name="l.display_name" size="md" :tone="l.is_self ? 'primary' : 'neutral'")
        .person__main
          .person__name {{ l.display_name }}
          .person__meta {{ l.recipient_value }}
        .person__right
          BaseChip(v-if="l.is_self" variant="neutral" size="sm") {{ $t('edubridge.memberLearnersPage.selfChip') }}
          q-icon.edu-learner__chevron(name="chevron_right" size="20px")

  //- Данные обучающегося правятся в правой панели — список остаётся на виду.
  DetailsDrawer(v-model="learnerDialogOpen" :title="editingLearner ? $t('edubridge.memberLearnersPage.editDialogTitle') : $t('edubridge.memberLearnersPage.newDialogTitle')" :width="520")
    LearnerForm(v-if="learnerDialogOpen" :key="editingLearner ? asText(editingLearner.id) : 'new'" :learner="editingLearner" :default-self="!learners.length" :has-self="learners.some((l) => l.is_self)" @saved="onLearnerSaved" @cancel="learnerDialogOpen = false")
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { asText } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert } from 'src/shared/api';
import { useHeaderActions } from 'src/shared/hooks';
import { Avatar, BaseCard, BaseChip, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { PageHint, DetailsDrawer } from 'src/shared/ui/domain';
import { fetchMyLearners, type ILearner } from '../../entities/Learner';
import { LearnerForm } from '../../widgets/LearnerForm';
import { HeaderActionButton } from '../../shared/ui/HeaderActionButton';
import { t } from '../../i18n';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';

/**
 * «Обучающиеся»: кто занимается и на какой адрес выдаётся доступ. Курсы и сроки
 * живут на соседней странице «Мои подписки» — здесь только состав обучающихся,
 * чтобы список не тонул рядом с таблицей подписок.
 */
const { registerAction } = useHeaderActions();

const learners = ref<ILearner[]>([]);
// Признак включён с самого начала: до конца первой загрузки на экране каркас, а не «пусто».
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const learnerDialogOpen = ref(false);
const editingLearner = ref<ILearner | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  try {
    learners.value = await fetchMyLearners();
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function addLearnerOpen(): void {
  editingLearner.value = null;
  learnerDialogOpen.value = true;
}
function editLearner(l: ILearner): void {
  editingLearner.value = l;
  learnerDialogOpen.value = true;
}
function onLearnerSaved(l: ILearner): void {
  const i = learners.value.findIndex((x) => x.id === l.id);
  if (i >= 0) learners.value[i] = l;
  else learners.value.push(l);
  learnerDialogOpen.value = false;
}

// Живое обновление: данные меняются в цепи и на столах других участников.
useLiveReload([EduLive.learners], load);

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
</style>
