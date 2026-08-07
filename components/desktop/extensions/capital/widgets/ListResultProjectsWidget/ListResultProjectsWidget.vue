<template lang="pug">
.results-projects
  .results-projects__skel(v-if='loading && !rows.length')
    .skel(v-for='i in 3', :key='i')

  EmptyState(
    v-else-if='!loading && !rows.length',
    title='Нет проектов для результатов',
    body='Когда компоненты перейдут к приёмке результатов, они появятся в этом списке.'
  )
    template(#icon)
      q-icon(name='assignment_turned_in')

  .results-projects__items(v-else)
    .results-projects__card(
      v-for='project in rows',
      :key='project.project_hash',
      role='button',
      tabindex='0',
      @click='openProject(project.project_hash)',
      @keydown.enter.prevent='openProject(project.project_hash)',
      @keydown.space.prevent='openProject(project.project_hash)'
    )
      .results-projects__main
        .results-projects__title-row
          span.results-projects__title {{ project.title }}
          BaseBadge(:variant='statusVariant(project.status)')
            | {{ statusLabel(project.status) }}

        .results-projects__sub(v-if='project.parent_title')
          q-icon(name='folder', size='14px')
          span.t-sm.t-muted {{ project.parent_title }}

      .results-projects__amount
        span.results-projects__amount-label.t-eyebrow ОАП
        span.results-projects__amount-value.t-mono {{ formatMoney(project.fact?.total) }}

      .results-projects__go
        q-icon(name='chevron_right', size='22px')
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useProjectStore } from '../../entities/Project/model';
import { Zeus } from '@coopenomics/sdk';
import { EmptyState, BaseBadge } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { getProjectStatusLabel } from '../../shared/lib/projectStatus';
import { useSystemStore } from 'src/entities/System/model';

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
const { info } = useSystemStore();

const loading = ref(false);
const pagination = ref({
  page: 1,
  rowsPerPage: 1000,
  rowsNumber: 0,
});

const projects = computed(() => projectStore.projects);
const rows = computed(() => projects.value?.items || []);

const governSymbol = computed(
  () => info.symbols?.root_govern_symbol || 'RUB',
);

const statusLabel = (status: string) => getProjectStatusLabel(status);

const statusVariant = (status: string): BaseBadgeVariant => {
  const s = status as Zeus.ProjectStatus;
  if (s === Zeus.ProjectStatus.RESULT) return 'pos';
  if (s === Zeus.ProjectStatus.VOTING) return 'info';
  if (s === Zeus.ProjectStatus.FINALIZED) return 'neutral';
  return 'neutral';
};

const formatMoney = (raw?: string) => {
  const src = raw || `0 ${governSymbol.value}`;
  return formatAsset2Digits(src);
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
        statuses: [
          Zeus.ProjectStatus.VOTING,
          Zeus.ProjectStatus.RESULT,
        ],
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
    console.error('Error loading result projects:', error);
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
.results-projects {
  min-width: 0;
}

.results-projects__skel {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);

  .skel {
    height: 72px;
    border-radius: var(--p-r-md);
  }
}

.results-projects__items {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.results-projects__card {
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

    .results-projects__go {
      color: var(--p-primary);
      background: var(--p-primary-soft);
    }

    .results-projects__amount-value {
      color: var(--p-ink);
    }
  }

  &:focus-visible {
    outline: none;
    box-shadow: var(--p-focus-ring);
  }
}

.results-projects__main {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  min-width: 0;
}

.results-projects__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-2);
  min-width: 0;
}

.results-projects__title {
  font-weight: 600;
  font-size: var(--p-fs-body);
  letter-spacing: -0.01em;
  color: var(--p-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.results-projects__sub {
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

.results-projects__amount {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
  min-width: 7.5rem;
}

.results-projects__amount-label {
  color: var(--p-ink-3);
}

.results-projects__amount-value {
  font-size: var(--p-fs-body);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--p-ink-1);
  white-space: nowrap;
  transition: color 0.12s ease;
}

.results-projects__go {
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

@media (max-width: 640px) {
  .results-projects__card {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'main go'
      'amount amount';
    gap: var(--p-3);
    padding: var(--p-3) var(--p-4);
  }

  .results-projects__main {
    grid-area: main;
  }

  .results-projects__amount {
    grid-area: amount;
    align-items: flex-start;
    padding-top: var(--p-2);
    border-top: 1px solid var(--p-line);
  }

  .results-projects__go {
    grid-area: go;
  }
}
</style>
