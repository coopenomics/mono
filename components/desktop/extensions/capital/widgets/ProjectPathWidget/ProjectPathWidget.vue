<template lang="pug">
.breadcrumb-path(:class="{ 'breadcrumb-path--custom': useCustomColor }" :style="pathStyle")
  // Родительский проект (если есть)
  .breadcrumb-item(
    v-if="project?.parent_hash && project?.parent_title"
    @click="goToParentProject(project.parent_hash)"
  )
    q-icon(name="folder", size="14px" :color="iconColorMuted")
    span {{ truncateText(project.parent_title, 30) }}
    q-icon.breadcrumb-link(name="open_in_new", size="10px" :color="iconColorMuted")

  // Разделитель
  .breadcrumb-separator(
    v-if="project?.parent_hash && project?.parent_title"
  ) /

  // Текущий проект/компонент
  .breadcrumb-item.current(
    v-if="project?.title"
    @click="goToCurrentItem(project?.project_hash)"
  )
    q-icon(name="task", size="14px" :color="iconColorCurrent")
    span {{ truncateText(project?.title || 'Загрузка...', 35) }}
    q-icon.breadcrumb-link(name="open_in_new", size="10px" :color="iconColorMuted")

</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import type { IProject } from 'app/extensions/capital/entities/Project/model';
import { capitalRouteName } from 'app/extensions/capital/shared/lib/capitalWorkspaceRoutes';

const router = useRouter();
const route = useRoute();

const props = defineProps<{
  project?: IProject | null;
  /** Опциональный цвет текста (например, для тёмного фона). Без него — канонные ink-токены. */
  textColor?: string;
}>();

const useCustomColor = computed(() => !!props.textColor);

const pathStyle = computed(() =>
  props.textColor ? { color: props.textColor } : undefined,
);

const iconColorMuted = computed(() => (useCustomColor.value ? props.textColor : 'grey-7'));
const iconColorCurrent = computed(() => (useCustomColor.value ? props.textColor : 'primary'));

// Функция для сокращения текста
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

// Переход вверх по крошке — обычный push: «назад» с целевой страницы вернёт
// сюда штатной историей (см. smartBack.ts), снимки маршрута в sessionStorage
// больше не нужны
const goToParentProject = (projectHash?: string) => {
  if (!projectHash) return;
  router.push({
    name: capitalRouteName('project-description', route),
    params: { project_hash: projectHash },
  });
};

const goToCurrentItem = (projectHash?: string) => {
  if (!projectHash) return;

  // Для текущего элемента: если есть parent_hash — это компонент, иначе — проект.
  // Со страницы задачи компонента чаще нужен список задач, а не описание.
  const routeNameRaw = String(route.name ?? '');
  const routeName = props.project?.parent_hash
    ? routeNameRaw.includes('component-issue') || routeNameRaw.includes('my-task-issue')
      ? capitalRouteName('component-tasks', route)
      : capitalRouteName('component-description', route)
    : capitalRouteName('project-description', route);

  router.push({
    name: routeName,
    params: { project_hash: projectHash },
  });
};
</script>

<style lang="scss" scoped>
.breadcrumb-path {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2);
  flex-wrap: wrap;
  max-width: 100%;
  font-size: var(--p-fs-meta);
  line-height: var(--p-lh-meta);
  color: var(--p-ink-2);
}

.breadcrumb-path.capital-entity-header-path {
  margin-top: 0;
  margin-bottom: 0;
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
}

.breadcrumb-path--custom .breadcrumb-item:hover,
.breadcrumb-path--custom .breadcrumb-item.current {
  color: inherit;
}

.breadcrumb-item {
  display: flex;
  align-items: center;
  gap: var(--p-1);
  cursor: pointer;
  color: inherit;
  font-weight: 500;
  transition: color var(--p-dur-fast) var(--p-ease-standard);

  &:hover {
    color: var(--p-primary);

    .breadcrumb-link {
      opacity: 1;
    }
  }

  &.current {
    font-weight: 600;
    color: var(--p-ink);

    &:hover {
      color: var(--p-primary);
    }
  }

  .q-icon {
    flex-shrink: 0;
  }

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.breadcrumb-separator {
  color: var(--p-ink-3);
  font-weight: normal;
  user-select: none;
}

.breadcrumb-link {
  opacity: 0.4;
  transition: opacity var(--p-dur-fast) var(--p-ease-standard);
  flex-shrink: 0;
}
</style>
