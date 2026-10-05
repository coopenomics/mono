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
      .person.person--row(v-for="l in learners" :key="asText(l.id)")
        Avatar(:name="l.display_name" size="md" :tone="l.is_self ? 'primary' : 'neutral'")
        .person__main
          .person__name {{ l.display_name }}
          .person__meta {{ l.recipient_value }}
        .person__right
          BaseChip(v-if="l.is_self" variant="neutral" size="sm") {{ $t('edubridge.memberLearnersPage.selfChip') }}
          BaseButton(variant="ghost" size="sm" icon-only :aria-label="$t('edubridge.memberLearnersPage.editAriaLabel')" @click="editLearner(l)")
            template(#icon-left)
              q-icon(name="edit" size="18px")

  BaseDialog(v-model="learnerDialogOpen" :title="editingLearner ? $t('edubridge.memberLearnersPage.editDialogTitle') : $t('edubridge.memberLearnersPage.newDialogTitle')" size="md")
    LearnerForm(:learner="editingLearner" :default-self="!learners.length" :has-self="learners.some((l) => l.is_self)" @saved="onLearnerSaved" @cancel="learnerDialogOpen = false")
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { asText } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert } from 'src/shared/api';
import { useHeaderActions } from 'src/shared/hooks';
import { Avatar, BaseButton, BaseCard, BaseChip, BaseDialog, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
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
const loading = ref(false);
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
