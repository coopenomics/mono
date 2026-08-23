<template lang="pug">
.planning-page
  //- Финансовый план — только кооперативные (блокчейн); LOCAL — только метрики
  .planning-page__section(v-if='project && !isLocalProject')
    .planning-page__head
      .planning-page__title План · {{ project.title }}
      .planning-page__sub.t-sm.t-muted План и факт по компоненту
    ProjectPlanningWidget(
      :project='project',
      :permissions='permissions'
    )

  .planning-page__skel(v-else-if='!project')
    .skel(v-for='i in 6', :key='i')

  .planning-page__section(v-if='project')
    ComponentMetricsPanel(:project-hash='project.project_hash')

  .planning-page__section(v-if='project')
    MetricSuperpositionPanel(:project-hash='project.project_hash')
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import type {
  IProject,
  IProjectPermissions,
} from 'app/extensions/capital/entities/Project/model';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { ProjectPlanningWidget } from 'app/extensions/capital/widgets';
import { FailAlert } from 'src/shared/api';
import { ComponentMetricsPanel } from 'app/extensions/capital/features/Metric/ManageComponentMetrics';
import { MetricSuperpositionPanel } from 'app/extensions/capital/features/Metric/ViewMetricSuperposition';

const route = useRoute();
const projectStore = useProjectStore();

const project = ref<IProject | null | undefined>(null);

const projectHash = computed(() => route.params.project_hash as string);

const isLocalProject = computed(() => project.value?.origin === 'local');

const permissions = computed((): IProjectPermissions | null => {
  return project.value?.permissions || null;
});

const loadProject = async () => {
  try {
    const loaded = await projectStore.loadProject({
      hash: projectHash.value,
    });
    project.value =
      (loaded as IProject | undefined) ??
      projectStore.getProject(projectHash.value) ??
      null;
  } catch (error) {
    console.error('Ошибка при загрузке компонента:', error);
    FailAlert('Не удалось загрузить компонент');
  }
};

watch(
  () => projectStore.entities[projectHash.value],
  (entity) => {
    if (entity) project.value = entity;
  },
);

watch(projectHash, async (newHash, oldHash) => {
  if (newHash && newHash !== oldHash) {
    await loadProject();
  }
});

onMounted(async () => {
  await loadProject();
});
</script>

<style lang="scss" scoped>
.planning-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-6);
  min-width: 0;
  /* Как q-pa-md / описание компонента — контент не на всю ширину без полей */
  padding: var(--p-4);
}

.planning-page__section {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  min-width: 0;
}

.planning-page__head {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}

.planning-page__title {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
  line-height: var(--p-lh-body);
}

.planning-page__skel {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}
</style>
