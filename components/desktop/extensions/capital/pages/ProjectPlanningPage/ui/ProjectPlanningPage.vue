<template lang="pug">
.planning-page
  //- Сводный финансовый план — только кооперативные проекты
  .planning-page__section(v-if='!isLocalProject')
    .planning-page__head
      .planning-page__title Сводный план · {{ project?.title || '…' }}
      .planning-page__sub.t-sm.t-muted
        | Агрегированные показатели из всех компонентов проекта
    ProjectPlanningWidget(
      v-if='project',
      :project='project',
      :permissions='permissions',
      always-show-plan
    )
    .planning-page__skel(v-else)
      .skel(v-for='i in 6', :key='i')

  .planning-page__section(v-if='project')
    MetricSuperpositionPanel(:project-hash='project.project_hash')

  //- Финансовые планы компонентов — только кооперативные
  template(v-if='!isLocalProject')
    .planning-page__section(
      v-for='component in components',
      :key='component.project_hash'
    )
      .planning-page__head
        .planning-page__title Компонент · {{ component.title }}
        .planning-page__sub.t-sm.t-muted Собственный план и факт компонента
      ProjectPlanningWidget(
        :project='component',
        :permissions='permissions'
      )
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import type {
  IProject,
  IProjectComponent,
  IProjectPermissions,
} from 'app/extensions/capital/entities/Project/model';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { ProjectPlanningWidget } from 'app/extensions/capital/widgets';
import { MetricSuperpositionPanel } from 'app/extensions/capital/features/Metric/ViewMetricSuperposition';
import { FailAlert } from 'src/shared/api';

const route = useRoute();
const projectStore = useProjectStore();

const project = ref<IProject | null | undefined>(null);

const projectHash = computed(() => route.params.project_hash as string);

const isLocalProject = computed(() => project.value?.origin === 'local');

const permissions = computed((): IProjectPermissions | null => {
  return project.value?.permissions || null;
});

const components = computed((): IProjectComponent[] => {
  return (project.value?.components as IProjectComponent[]) || [];
});

const loadProject = async () => {
  if (!projectHash.value) return;

  try {
    const loaded = await projectStore.loadProject({
      hash: projectHash.value,
    });
    project.value =
      (loaded as IProject | undefined) ??
      projectStore.getProject(projectHash.value) ??
      null;
  } catch (error) {
    console.error('Ошибка при загрузке проекта с компонентами:', error);
    FailAlert('Не удалось загрузить проект с компонентами');
    project.value = null;
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
