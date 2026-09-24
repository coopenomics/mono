<template lang="pug">
div(ref="widgetRootRef")
  // Button group для переключения между описанием и приглашением
  q-btn-group

    q-btn(
      size="md"
      :outline="activeTab !== 'description'",
      color="primary",
      :label="$t('capital.projectInfoSelectorWidget.descriptionTabLabel')",
      @click="activeTab = 'description'"
    )
    q-btn(
      size="md"
      :outline="activeTab !== 'invite'",
      color="primary",
      :label="$t('capital.projectInfoSelectorWidget.inviteTabLabel')",
      @click="activeTab = 'invite'"
    )

    q-btn(
      size="md"
      :outline="activeTab !== 'planning'",
      color="primary",
      :label="$t('capital.projectInfoSelectorWidget.fundingTabLabel')",
      @click="activeTab = 'planning'"
    )
    q-btn(
      size="md"
      :outline="activeTab !== 'contributors'"
      color="primary"
      :label="$t('capital.projectInfoSelectorWidget.contributorsTabLabel')"
      @click="activeTab = 'contributors'"
    )

  // Редактор описания
  div(v-if="activeTab === 'description'")
    span.editor-viewport-anchor(ref="descriptionEditorTopRef" aria-hidden="true")
    Editor(
      :min-height="descriptionEditorMinHeight"
      v-if="project"
      v-model='description',
      :placeholder='descriptionPlaceholder || $t("capital.projectInfoSelectorWidget.descriptionPlaceholder")',
      :readonly="!permissions?.can_edit_project",
      :padded="false"
      :show-focus-ring="true"
    )

  // Редактор приглашения
  div(v-if="activeTab === 'invite'")
    span.editor-viewport-anchor(ref="inviteEditorTopRef" aria-hidden="true")
    Editor(
      :min-height="inviteEditorMinHeight"
      v-if="project"
      v-model='invite',
      :placeholder='invitePlaceholder || $t("capital.projectInfoSelectorWidget.invitePlaceholder")',
      :readonly="!permissions?.can_edit_project",
      :padded="false"
      :show-focus-ring="true"
    )



  // Участники проекта
  div(v-if="activeTab === 'contributors'" )
    ProjectContributorsList(:project='project' style="min-height: 300px;")

</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import { useEditorViewportMinHeight } from 'src/shared/lib/composables/useEditorViewportMinHeight';
import type { IProject, IProjectPermissions } from 'app/extensions/capital/entities/Project/model';
import { Editor } from 'src/shared/ui';

import ProjectContributorsList from './ProjectContributorsList.vue';

const props = defineProps<{
  project: IProject | null | undefined;
  descriptionPlaceholder?: string;
  invitePlaceholder?: string;
  permissions?: IProjectPermissions | null;
}>();

const emit = defineEmits<{
  'update:description': [value: string];
  'update:invite': [value: string];
  fieldChange: [];
}>();

const widgetRootRef = ref<HTMLElement | null>(null);
const descriptionEditorTopRef = ref<HTMLElement | null>(null);
const inviteEditorTopRef = ref<HTMLElement | null>(null);

const descriptionEditorMinHeight = useEditorViewportMinHeight(descriptionEditorTopRef, {
  observeRef: widgetRootRef,
  min: 200,
  bottomGap: 28,
});

const inviteEditorMinHeight = useEditorViewportMinHeight(inviteEditorTopRef, {
  observeRef: widgetRootRef,
  min: 200,
  bottomGap: 28,
});

// Активная вкладка
const activeTab = ref<'description' | 'invite' | 'management' | 'planning' | 'contributors'>('description');

// Следим за изменением permissions и переключаем на доступную вкладку
watch(() => props.permissions, (newPermissions) => {
  if (!newPermissions?.can_edit_project && (activeTab.value === 'management' || activeTab.value === 'planning')) {
    activeTab.value = 'description';
  }
});

// Computed свойства для двухсторонней привязки
const description = computed({
  get: () => props.project?.description || '',
  set: (value: string) => {
    emit('update:description', value);
    emit('fieldChange');
  }
});

const invite = computed({
  get: () => props.project?.invite || '',
  set: (value: string) => {
    emit('update:invite', value);
    emit('fieldChange');
  }
});
</script>

<style lang="scss" scoped>
.editor-viewport-anchor {
  display: block;
  height: 0;
  width: 100%;
  pointer-events: none;
}
</style>
