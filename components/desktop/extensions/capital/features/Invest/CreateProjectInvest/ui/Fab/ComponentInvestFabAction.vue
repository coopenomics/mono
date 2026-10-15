<template lang="pug">
// Рендерим как обычную кнопку, если передан флаг fab
q-btn(
  v-if="fab"
  color="accent"
  :label="fabMainLabel"
  icon="attach_money"
  @click="handleClick"
  :disable="!project?.is_planed || project?.is_opened === false"
  fab
).bg-fab-accent-radial
  q-tooltip(
    v-if="!project?.is_planed || project?.is_opened === false"
    anchor="top middle"
    self="bottom middle"
  )
    span(v-if="!project?.is_planed") {{ $t('capital.componentInvestFabAction.plannedOnlyHint') }}
    span(v-else-if="project?.is_opened === false") {{ $t('capital.componentInvestFabAction.notAcceptingHint') }}
  CreateProjectInvestDialog(
    ref="dialogRef"
    :project="project"
    @success="handleSuccess"
  )

// Иначе рендерим как экшен для FAB
q-fab-action.bg-fab-accent-radial(
  v-else
  icon="attach_money"
  :label="fabActionLabel"
  @click="handleClick"
  text-color="white"
  :disable="!project?.is_planed || project?.is_opened === false"
)
  q-tooltip(
    v-if="!project?.is_planed || project?.is_opened === false"
    anchor="top middle"
    self="bottom middle"
  )
    span(v-if="!project?.is_planed") {{ $t('capital.componentInvestFabAction.plannedOnlyHint') }}
    span(v-else-if="project?.is_opened === false") {{ $t('capital.componentInvestFabAction.notAcceptingHint') }}

  CreateProjectInvestDialog(
    ref="dialogRef"
    :project="project"
    @success="handleSuccess"
  )

</template>

<script setup lang="ts">
import { ref } from 'vue';
import { CreateProjectInvestDialog } from '../Dialog';
import type { IProject } from '../../../../../entities/Project/model';
import { formatCapitalFabLabel } from 'app/extensions/capital/shared/lib';
import { t } from '../../../../../i18n';

const props = defineProps<{
  project: IProject | null | undefined;
  fab?: boolean;
}>();

const emit = defineEmits<{
  actionCompleted: [];
}>();

const fabMainLabel = formatCapitalFabLabel(t('capital.componentInvestFabAction.label'), 'invest');
const fabActionLabel = formatCapitalFabLabel(t('capital.componentInvestFabAction.shortLabel'), 'invest');

const dialogRef = ref();

const handleClick = () => {
  if (props.project?.is_planed && props.project?.is_opened !== false) {
    dialogRef.value?.openDialog();
  }
};

const handleSuccess = () => {
  emit('actionCompleted');
};

defineExpose({
  openDialog: handleClick,
});
</script>
