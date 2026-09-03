<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:member-learners:banner-dismissed")
    | Обучающийся — это тот, кто занимается: вы сами или ребёнок. У каждого свой адрес: именно на него
    | площадка выдаёт доступ к курсу. Записать обучающегося на курс можно на странице «Мои подписки».

  BaseCard(variant="default" title="Обучающиеся")
    CardListSkeleton(v-if="loading && !learners.length" :count="2")
    EmptyState(v-else-if="!learners.length" title="Обучающихся пока нет" body="Добавьте первого обучающегося — себя или ребёнка.")
      template(#icon)
        q-icon(name="family_restroom" size="32px")
      template(#action)
        BaseButton.q-mt-md(variant="primary" @click="addLearnerOpen()") Добавить обучающегося
    q-list(v-else separator)
      q-item(v-for="l in learners" :key="l.id")
        q-item-section
          .text-weight-medium {{ l.display_name }}
            BaseChip.q-ml-sm(v-if="l.is_self" variant="neutral" size="sm") я
          .t-muted.t-sm.t-mono {{ l.recipient_value }}
        q-item-section(side)
          BaseButton(variant="ghost" size="sm" icon-only aria-label="Изменить" @click="editLearner(l)")
            template(#icon-left)
              q-icon(name="edit" size="18px")
    .q-mt-md(v-if="learners.length")
      BaseButton(variant="secondary" block @click="addLearnerOpen()") Добавить обучающегося

  BaseDialog(v-model="learnerDialogOpen" :title="editingLearner ? 'Изменить обучающегося' : 'Новый обучающийся'" size="md")
    LearnerForm(:learner="editingLearner" @saved="onLearnerSaved" @cancel="learnerDialogOpen = false")
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import { useHeaderActions } from 'src/shared/hooks';
import { BaseButton, BaseCard, BaseChip, BaseDialog, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { fetchMyLearners, type ILearner } from '../../entities/Learner';
import { LearnerForm } from '../../widgets/LearnerForm';
import AddLearnerHeaderButton from './AddLearnerHeaderButton.vue';

/**
 * «Обучающиеся»: кто занимается и на какой адрес выдаётся доступ. Курсы и сроки
 * живут на соседней странице «Мои подписки» — здесь только состав обучающихся,
 * чтобы список не тонул рядом с таблицей подписок.
 */
const { registerAction } = useHeaderActions();

const learners = ref<ILearner[]>([]);
const loading = ref(false);
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

onMounted(async () => {
  registerAction({ id: 'edubridge:add-learner', component: AddLearnerHeaderButton, props: { onClick: addLearnerOpen } });
  await load();
});
</script>
