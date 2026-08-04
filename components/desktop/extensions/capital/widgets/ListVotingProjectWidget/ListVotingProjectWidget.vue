<template lang="pug">
.voting-projects
  .voting-projects__skel(v-if='loading && !rows.length')
    .skel(v-for='i in 3', :key='i')

  EmptyState(
    v-else-if='!loading && !rows.length',
    title='Нет проектов на голосовании',
    body='Когда компоненты перейдут к этапу голосования, они появятся в этом списке.'
  )
    template(#icon)
      q-icon(name='how_to_vote')

  .voting-projects__items(v-else)
    .voting-projects__card(
      v-for='project in rows',
      :key='project.project_hash',
      role='button',
      tabindex='0',
      @click='openProject(project.project_hash)',
      @keydown.enter.prevent='openProject(project.project_hash)',
      @keydown.space.prevent='openProject(project.project_hash)'
    )
      .voting-projects__main
        .voting-projects__title-row
          span.voting-projects__title {{ project.title }}
          BaseBadge(:variant='getVotingStatusVariant(project.status)')
            | {{ getVotingStatusText(project.status) }}

        .voting-projects__sub(v-if='project.parent_title')
          q-icon(name='folder', size='14px')
          span.t-sm.t-muted {{ project.parent_title }}

      .voting-projects__meta
        .voting-projects__meta-item(v-if='project.voting?.voting_deadline')
          span.voting-projects__meta-label.t-eyebrow До
          span.voting-projects__meta-value {{ formatDeadline(project.voting.voting_deadline) }}
        .voting-projects__meta-item
          span.voting-projects__meta-label.t-eyebrow Пул
          span.voting-projects__meta-value.t-mono {{ formatPool(project) }}

      .voting-projects__go
        q-icon(name='chevron_right', size='22px')
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useProjectStore } from '../../entities/Project/model';
import { Zeus } from '@coopenomics/sdk';
import { EmptyState, BaseBadge } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';

interface Props {
  coopname: string;
}

interface Emits {
  (e: 'open-project', value: string): void;
  (e: 'data-loaded', value: string[]): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const projectStore = useProjectStore();

const loading = ref(false);
const pagination = ref({
  page: 1,
  rowsPerPage: 1000,
  rowsNumber: 0,
});

const projects = computed(() => projectStore.projects);
const rows = computed(() => projects.value?.items || []);

const getVotingStatusText = (status: string) => {
  const projectStatus = status as Zeus.ProjectStatus;
  if (projectStatus === Zeus.ProjectStatus.VOTING) return 'Активно';
  if (
    projectStatus === Zeus.ProjectStatus.RESULT ||
    projectStatus === Zeus.ProjectStatus.CANCELLED
  ) {
    return 'Завершено';
  }
  return 'Неизвестно';
};

const getVotingStatusVariant = (status: string): BaseBadgeVariant => {
  const projectStatus = status as Zeus.ProjectStatus;
  if (projectStatus === Zeus.ProjectStatus.VOTING) return 'pos';
  if (
    projectStatus === Zeus.ProjectStatus.RESULT ||
    projectStatus === Zeus.ProjectStatus.CANCELLED
  ) {
    return 'warn';
  }
  return 'neutral';
};

const formatDeadline = (deadline?: string) => {
  if (!deadline) return '—';
  try {
    const date = new Date(deadline);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return deadline;
  }
};

const formatPool = (project: { voting?: { amounts?: { total_voting_pool?: string } } }) => {
  return formatAsset2Digits(project.voting?.amounts?.total_voting_pool || '0');
};

const openProject = (projectHash: string) => {
  emit('open-project', projectHash);
};

const loadProjects = async () => {
  loading.value = true;
  try {
    await projectStore.loadProjects({
      filter: {
        coopname: props.coopname,
        has_voting: true,
      },
      options: {
        page: pagination.value.page,
        limit: pagination.value.rowsPerPage,
        sortOrder: 'DESC',
      },
    });

    pagination.value.rowsNumber = projects.value.totalCount;
    emit(
      'data-loaded',
      projects.value?.items.map((p) => p.project_hash) || [],
    );
  } catch (error) {
    console.error('Error loading voting projects:', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadProjects();
});

watch(
  () => props.coopname,
  () => {
    loadProjects();
  },
);
</script>

<style lang="scss" scoped>
.voting-projects {
  min-width: 0;
}

.voting-projects__skel {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);

  .skel {
    height: 72px;
    border-radius: var(--p-r-md);
  }
}

.voting-projects__items {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.voting-projects__card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--p-5);
  padding: var(--p-4) var(--p-5);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);
  cursor: pointer;
  transition:
    background-color 0.12s ease,
    border-color 0.12s ease;

  &:hover {
    background: var(--p-canvas-2);
    border-color: var(--p-primary-line);

    .voting-projects__go {
      color: var(--p-primary);
      background: var(--p-primary-soft);
    }

    .voting-projects__meta-value {
      color: var(--p-ink);
    }
  }

  &:focus-visible {
    outline: none;
    box-shadow: var(--p-focus-ring);
  }
}

.voting-projects__main {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  min-width: 0;
}

.voting-projects__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-2);
  min-width: 0;
}

.voting-projects__title {
  font-weight: 600;
  font-size: var(--p-fs-body);
  letter-spacing: -0.01em;
  color: var(--p-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.voting-projects__sub {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  min-width: 0;

  .q-icon {
    flex-shrink: 0;
    color: var(--p-ink-3);
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.voting-projects__meta {
  display: flex;
  align-items: center;
  gap: var(--p-5);
  flex-shrink: 0;
}

.voting-projects__meta-item {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  min-width: 5.5rem;
}

.voting-projects__meta-label {
  color: var(--p-ink-3);
}

.voting-projects__meta-value {
  font-size: var(--p-fs-body);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--p-ink-1);
  white-space: nowrap;
  transition: color 0.12s ease;
}

.voting-projects__go {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--p-r-sm);
  color: var(--p-ink-3);
  transition:
    color 0.12s ease,
    background-color 0.12s ease;
}

@media (max-width: 720px) {
  .voting-projects__card {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'main go'
      'meta meta';
    gap: var(--p-3);
    padding: var(--p-3) var(--p-4);
  }

  .voting-projects__main {
    grid-area: main;
  }

  .voting-projects__meta {
    grid-area: meta;
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: var(--p-4);
    padding-top: var(--p-2);
    border-top: 1px solid var(--p-line);
  }

  .voting-projects__meta-item {
    align-items: flex-start;
  }

  .voting-projects__go {
    grid-area: go;
  }
}
</style>
