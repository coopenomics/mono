<template lang="pug">
.component-to-project-path
  // Путь к родительскому проекту
  .breadcrumb-item(
    v-if="project?.parent_hash && parentProject?.title"
    @click="goToParentProject"
  )
    q-icon(name="folder", size="14px", color="grey-7")
    span {{ truncateText(parentProject.title, 35) }}
    q-icon.breadcrumb-link(name="open_in_new", size="10px")

  // Или сообщение, если проект не загружен
  .breadcrumb-loading(v-else-if="project?.parent_hash && !parentProject")
    q-icon(name="folder", size="14px", color="grey-5")
    span.text-grey-6 Загрузка проекта...


</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import type { IProject } from 'app/extensions/capital/entities/Project/model';
import { api as ProjectApi } from 'app/extensions/capital/entities/Project/api';

const router = useRouter();
const route = useRoute();

const props = defineProps<{
  project?: IProject | null;
}>();

// Родительский проект
const parentProject = ref<IProject | null>(null);

// Функция для сокращения текста
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

// Загрузка информации о родительском проекте
const loadParentProject = async () => {
  if (props.project?.parent_hash && !parentProject.value) {
    try {
      const projectData = await ProjectApi.loadProject({
        hash: props.project.parent_hash,
      });

      if (projectData) {
        parentProject.value = projectData;
      }
    } catch (error) {
      console.error('Ошибка при загрузке родительского проекта:', error);
      parentProject.value = null;
    }
  }
};

// Переход к родительскому проекту
const goToParentProject = () => {
  if (!props.project?.parent_hash) return;

  // Сохраняем текущие параметры маршрута для возможности возврата
  const backRouteKey = `backroute_${Date.now()}`;
  sessionStorage.setItem(backRouteKey, JSON.stringify({
    name: route.name,
    params: route.params,
    query: { ...route.query, _backRoute: undefined, _useHistoryBack: undefined }
  }));

  // Переходим на страницу описания проекта
  router.push({
    name: 'project-description',
    params: { project_hash: props.project.parent_hash },
    query: {
      _backRoute: backRouteKey
    }
  });
};

// Загружаем родительский проект при изменении props.project
watch(() => props.project, async (newProject) => {
  if (newProject?.parent_hash) {
    await loadParentProject();
  } else {
    parentProject.value = null;
  }
}, { immediate: true });

// Инициализация
onMounted(async () => {
  if (props.project?.parent_hash) {
    await loadParentProject();
  }
});
</script>

<style lang="scss" scoped>
.component-to-project-path {
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
}

// Шапка страницы сущности: над заголовком, без верхнего «воздуха»
.component-to-project-path.capital-entity-header-path {
  margin-top: 0;
  margin-bottom: var(--p-1);
}

.breadcrumb-item {
  display: flex;
  align-items: center;
  gap: var(--p-1);
  cursor: pointer;
  color: var(--p-ink-2);
  font-weight: 500;
  transition: color var(--p-dur-fast) var(--p-ease-standard);

  &:hover {
    color: var(--p-primary);

    .breadcrumb-link {
      opacity: 1;
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

.breadcrumb-loading,
.breadcrumb-info {
  display: flex;
  align-items: center;
  gap: var(--p-1);
  color: var(--p-ink-3);
  font-weight: normal;

  .q-icon {
    flex-shrink: 0;
  }
}

.breadcrumb-link {
  opacity: 0.4;
  transition: opacity var(--p-dur-fast) var(--p-ease-standard);
  flex-shrink: 0;
}
</style>
