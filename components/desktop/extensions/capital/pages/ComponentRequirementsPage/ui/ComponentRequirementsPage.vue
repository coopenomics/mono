<template lang="pug">
div
  .flex.flex-center.q-pa-lg(v-if='!permissionsLoaded')
    q-spinner(color='primary' size='40px')
  ArtifactsAccessPlaceholder(
    v-else-if='!canViewArtifacts'
    scope='component'
    :pending='componentPermissions?.pending_clearance === true'
  )
    template(#action)
      PendingClearanceButton(v-if='componentPermissions?.pending_clearance')
      MakeClearanceButton(
        v-else-if='component'
        :project='component'
        @clearance-submitted='handleClearanceSubmitted'
      )
  RequirementsListWidget(
    v-else
    :filter='requirementsFilter',
    :maxItems='50'
    :permissions='componentPermissions'
    detail-route-name='component-requirement-detail'
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

const component = ref<IProject | null>(null);
const componentPermissions = ref<IProjectPermissions | null>(null);
const permissionsLoaded = ref(false);

// Получаем hash компонента из параметров маршрута
const projectHash = computed(() => route.params.project_hash as string);

// Только этот компонент (без вложенных компонентов и без артефактов задач)
const requirementsFilter = computed(() => ({
  project_hash: projectHash.value,
  show_components_requirements: false,
  show_issues_requirements: false,
}));

// Право просмотра артефактов компонента: собственный допуск, либо допуск к родителю-проекту,
// либо роль председателя/члена совета (всё это учтено бэкендом в can_view_artifacts).
const canViewArtifacts = computed(() => {
  const perms = componentPermissions.value;
  if (!perms) return false;
  return perms.can_view_artifacts ?? (perms.has_clearance || perms.has_parent_clearance);
});

const loadComponentPermissions = async () => {
  permissionsLoaded.value = false;
  try {
    const loaded = await projectStore.loadProject({ hash: projectHash.value });
    component.value = loaded ?? null;
    componentPermissions.value = loaded?.permissions ?? null;
  } catch (error) {
    console.error('Ошибка при загрузке разрешений компонента:', error);
    component.value = null;
    componentPermissions.value = null;
  } finally {
    permissionsLoaded.value = true;
  }
};

const handleClearanceSubmitted = async () => {
  await loadComponentPermissions();
};

watch(projectHash, () => {
  void loadComponentPermissions();
});

onMounted(async () => {
  await loadComponentPermissions();
});
</script>

<style lang="scss" scoped>
</style>
