<template lang="pug">
div
  // Рендерим как обычную кнопку, если передан флаг fab
  q-btn.bg-fab-accent-radial(
    v-if="fab"
    color="accent"
    :label="fabMainLabel"
    icon="attach_money"
    @click="openInvest"
    fab
  )

  // Иначе рендерим как экшен для FAB
  q-fab-action.bg-fab-accent-radial(
    v-else
    icon="attach_money"
    :label="fabActionLabel"
    @click="openInvest"
    text-color="white"
  )

  BaseDialog(
    v-model="showDialog",
    title="Инвестирование в проект",
    size="sm",
    @update:model-value="(v) => !v && (showDialog = false)"
  )
    q-card-section.row.items-center
      span Инвестиции в проект деньгами или результатами доступны только через их компоненты. Пожалуйста, выберите компонент из списка и инвестируйте во все или в некоторые из них по отдельности.
      div.q-mt-md
        q-btn(flat label="Понятно" @click="showDialog = false")
        q-btn(
          color="primary"
          label="Перейти к компонентам"
          @click="goToComponents"
        )
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import type { IProject } from '../../../../../entities/Project/model';
import { formatCapitalFabLabel } from 'app/extensions/capital/shared/lib';

const props = defineProps<{
  project: IProject | null | undefined;
  fab?: boolean;
}>();
const router = useRouter();
const showDialog = ref(false);

const fabMainLabel = formatCapitalFabLabel('Инвестировать', 'invest');
const fabActionLabel = formatCapitalFabLabel('Инвестиция', 'invest');

const openInvest = () => {
  showDialog.value = true;
};

const goToComponents = () => {
  if (props.project?.project_hash) {
    router.push({
      name: 'project-components',
      params: { project_hash: props.project.project_hash }
    });
  }
  showDialog.value = false;
};

defineExpose({
  openDialog: openInvest,
});
</script>
