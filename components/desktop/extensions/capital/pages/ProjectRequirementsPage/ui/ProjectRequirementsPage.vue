<template lang="pug">
div
  .flex.flex-center.q-pa-lg(v-if='!permissionsLoaded')
    q-spinner(color='primary' size='40px')
  ArtifactsAccessPlaceholder(
    v-else-if='!canViewArtifacts'
    scope='project'
    :pending='projectPermissions?.pending_clearance === true'
  )
    template(#action)
      PendingClearanceButton(v-if='projectPermissions?.pending_clearance')
      MakeClearanceButton(
        v-else-if='project'
        :project='project'
        @clearance-submitted='handleClearanceSubmitted'
      )
  RequirementsListWidget(
    v-else
    :filter='requirementsFilter',
    :maxItems='50'
    :permissions='projectPermissions'
    detail-route-name='project-requirement-detail'
    :show-component-scope-badge='true'
  )
</template>

<script lang="ts" setup>
import { computed, ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { RequirementsListWidget } from 'app/extensions/capital/widgets/RequirementsListWidget';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import type { IProject, IProjectPermissions } from 'app/extensions/capital/entities/Project/model';
import { ArtifactsAccessPlaceholder } from 'app/extensions/capital/shared/ui/ArtifactsAccessPlaceholder';
import { PendingClearanceButton } from 'app/extensions/capital/shared/ui/PendingClearanceButton';
import { MakeClearanceButton } from 'app/extensions/capital/features/Contributor/MakeClearance';

const route = useRoute();
const projectStore = useProjectStore();

const project = ref<IProject | null>(null);
const projectPermissions = ref<IProjectPermissions | null>(null);
const permissionsLoaded = ref(false);

// Получаем hash проекта из параметров маршрута
const projectHash = computed(() => route.params.project_hash as string);

// Фильтр: артефакты корня + всех дочерних компонентов (задачи — отдельным флагом при необходимости)
const requirementsFilter = computed(() => ({
  project_hash: projectHash.value,
  show_components_requirements: true,
  show_issues_requirements: false,
}));

// Право просмотра артефактов: либо председатель/член совета, либо собственный допуск.
// На странице корневого проекта допуск к родителю смысла не имеет — но поле есть, оставляем для единообразия.
const canViewArtifacts = computed(() => {
  const perms = projectPermissions.value;
  if (!perms) return false;
  return perms.can_view_artifacts ?? (perms.has_clearance || perms.has_parent_clearance);
});

// Загрузка проекта и его разрешений
const loadProjectPermissions = async () => {
  permissionsLoaded.value = false;
  try {
    const loaded = await projectStore.loadProject({ hash: projectHash.value });
    project.value = loaded ?? null;
    projectPermissions.value = loaded?.permissions ?? null;
  } catch (error) {
    console.error('Ошибка при загрузке разрешений проекта:', error);
    project.value = null;
    projectPermissions.value = null;
  } finally {
    permissionsLoaded.value = true;
  }
};

const handleClearanceSubmitted = async () => {
  await loadProjectPermissions();
};

watch(projectHash, () => {
  void loadProjectPermissions();
});

onMounted(async () => {
  await loadProjectPermissions();
});
</script>

<style lang="scss" scoped>
</style>
