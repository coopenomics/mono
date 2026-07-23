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

const goToParentProject = (projectHash?: string) => {
  if (!projectHash) return;

  // Сохраняем текущие параметры маршрута для возможности возврата
  const backRouteKey = `backroute_${Date.now()}`;
  sessionStorage.setItem(backRouteKey, JSON.stringify({
    name: route.name,
    params: route.params,
    query: { ...route.query, _backRoute: undefined, _useHistoryBack: undefined } // Убираем циклические ссылки
  }));

  // Родительский элемент всегда проект, переходим на страницу описания проекта
  router.push({
    name: 'project-description',
    params: { project_hash: projectHash },
    query: {
      _backRoute: backRouteKey
    }
  });
};

const goToCurrentItem = (projectHash?: string) => {
  if (!projectHash) return;

  // Сохраняем текущие параметры маршрута для возможности возврата
  const backRouteKey = `backroute_${Date.now()}`;
  sessionStorage.setItem(backRouteKey, JSON.stringify({
    name: route.name,
    params: route.params,
    query: { ...route.query, _backRoute: undefined, _useHistoryBack: undefined } // Убираем циклические ссылки
  }));

  // Для текущего элемента: если есть parent_hash — это компонент, иначе — проект.
  // Со страницы задачи компонента чаще нужен список задач, а не описание.
  const routeName = props.project?.parent_hash
    ? route.name === 'component-issue'
      ? 'component-tasks'
      : 'component-description'
    : 'project-description';

  router.push({
    name: routeName,
    params: { project_hash: projectHash },
    query: {
      _backRoute: backRouteKey
    }
  });
};
</script>

<style lang="scss" scoped>
.breadcrumb-path {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  flex-wrap: wrap;
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}

.breadcrumb-path.capital-entity-header-path {
  margin-top: 0;
  margin-bottom: 0;
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
