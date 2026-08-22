<template lang="pug">
.project-contributors-page
  // Список участников
  ProjectContributorsList(:project='project')
</template>

<script lang="ts" setup>
import { onMounted, onBeforeUnmount } from 'vue';
import { useProjectLoader } from 'app/extensions/capital/entities/Project/model';
import ProjectContributorsList from 'app/extensions/capital/widgets/ProjectInfoSelectorWidget/ProjectContributorsList.vue';
import { useDataPoller } from 'src/shared/lib/composables';
import { POLL_INTERVALS } from 'src/shared/lib/consts';

// Используем composable для загрузки проекта
const { project, loadProject } = useProjectLoader();

/**
 * Функция для перезагрузки данных проекта
 * Используется для poll обновлений
 */
const reloadProjectData = async () => {
  try {
    // Перезагружаем данные текущего проекта
    await loadProject();
  } catch (error) {
    console.warn('Ошибка при перезагрузке данных проекта в poll:', error);
  }
};

// Настраиваем poll обновление данных
const { start: startProjectPoll, stop: stopProjectPoll } = useDataPoller(
  reloadProjectData,
  { interval: POLL_INTERVALS.MEDIUM, immediate: false }
);

// Инициализация
onMounted(async () => {
  await loadProject();

  // Запускаем poll обновление данных
  startProjectPoll();
});

// Останавливаем poll при уходе со страницы
onBeforeUnmount(() => {
  stopProjectPoll();
});
</script>

<style lang="scss" scoped>
// Заполняет page-surface, чтобы список мог взять height: 100% и держать
// прокрутку внутри себя
.project-contributors-page {
  height: 100%;
  min-height: 100%;
}
</style>
