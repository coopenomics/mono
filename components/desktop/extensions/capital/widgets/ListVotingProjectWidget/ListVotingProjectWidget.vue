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
      .voting-projects__icon
        q-icon(name='how_to_vote', size='22px')

      .voting-projects__body
        .voting-projects__title-row
          span.voting-projects__title {{ project.title }}
          BaseBadge(:variant='getVotingStatusVariant(project.status)')
            | {{ getVotingStatusText(project.status) }}

        .voting-projects__sub.t-sm.t-muted(v-if='project.parent_title')
          | {{ project.parent_title }}

        .voting-projects__facts
          .voting-projects__fact(v-if='project.voting?.voting_deadline')
            q-icon(name='event', size='16px')
            span до {{ formatDeadline(project.voting.voting_deadline) }}
          .voting-projects__fact
            q-icon(name='account_balance', size='16px')
            span.t-mono {{ formatAsset2Digits(project.voting?.amounts?.total_voting_pool || '0') }}

      .voting-projects__go
        span.t-sm Открыть
        q-icon(name='arrow_forward', size='18px')
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
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return deadline;
  }
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
    height: 88px;
    border-radius: var(--p-r-md);
  }
}

.voting-projects__items {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.voting-projects__card {
  display: flex;
  align-items: center;
  gap: var(--p-4);
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
    }

    .voting-projects__icon {
      background: var(--p-primary-soft);
      color: var(--p-primary);
    }
  }

  &:focus-visible {
    outline: none;
    box-shadow: var(--p-focus-ring);
  }
}

.voting-projects__icon {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--p-r-sm);
  background: var(--p-surface-3);
  color: var(--p-ink-1);
  box-shadow: inset 0 0 0 1px var(--p-line-1);
  transition:
    background-color 0.12s ease,
    color 0.12s ease;
}

.voting-projects__body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
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
  color: var(--p-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.voting-projects__sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.voting-projects__facts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--p-4);
}

.voting-projects__fact {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  color: var(--p-ink-2);
  font-size: var(--p-fs-sm, 13px);

  .q-icon {
    color: var(--p-ink-3);
  }
}

.voting-projects__go {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  color: var(--p-ink-3);
  font-weight: 500;
  transition: color 0.12s ease;
}

@media (max-width: 640px) {
  .voting-projects__go span {
    display: none;
  }

  .voting-projects__card {
    gap: var(--p-3);
    padding: var(--p-3) var(--p-4);
  }
}
</style>
