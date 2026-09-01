<template lang="pug">
.project-component-info
  .project-component-info__parent(
    v-if='parentTitle',
    @click.stop='navigateToProject(parentHash)'
  )
    q-icon(name='folder', size='16px')
    span {{ parentTitle }}
  .project-component-info__child(
    v-if='title',
    :class='{ "project-component-info__child--nested": !!parentTitle }',
    @click.stop='navigateToComponent(projectHash)'
  )
    q-icon(name='description', size='16px')
    span {{ title }}
</template>

<script lang="ts" setup>
import { useRouter, useRoute } from 'vue-router';
import { capitalRouteName } from 'app/extensions/capital/shared/lib/capitalWorkspaceRoutes';

interface Props {
  title?: string;
  parentTitle?: string;
  projectHash?: string;
  parentHash?: string;
}

const { parentHash, projectHash } = defineProps<Props>();

const router = useRouter();
const route = useRoute();

const navigateToProject = (hash?: string) => {
  if (hash) {
    router.push({
      name: capitalRouteName('project-description', route),
      params: { project_hash: hash },
    });
  }
};

const navigateToComponent = (hash?: string) => {
  if (hash) {
    router.push({
      name: capitalRouteName('component-description', route),
      params: { project_hash: hash },
    });
  }
};
</script>

<style lang="scss" scoped>
.project-component-info {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  min-width: 0;
}

.project-component-info__parent,
.project-component-info__child {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  min-width: 0;
  padding: var(--p-1) var(--p-2);
  border-radius: var(--p-r-sm);
  cursor: pointer;
  transition: background-color 0.12s ease;
  color: var(--p-ink);
  font-size: var(--p-fs-body);
  font-weight: 500;

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &:hover {
    background-color: var(--p-surface-2);
    color: var(--p-primary);
  }

  .q-icon {
    flex-shrink: 0;
    color: var(--p-ink-3);
  }
}

.project-component-info__child--nested {
  margin-left: var(--p-4);
  padding-left: var(--p-3);
  border-left: 2px solid var(--p-line);
  border-radius: 0 var(--p-r-sm) var(--p-r-sm) 0;
}
</style>
