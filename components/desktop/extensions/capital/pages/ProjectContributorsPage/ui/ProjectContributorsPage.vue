<template lang="pug">
.project-contributors-page
  // Список участников
  ProjectContributorsList(:project='project')
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';
import { useLiveReload } from 'src/shared/lib/realtime';
import { CAPITAL_LIVE_TABLES } from 'app/extensions/capital/shared/lib/live';
import { useProjectLoader } from 'app/extensions/capital/entities/Project/model';
import ProjectContributorsList from 'app/extensions/capital/widgets/ProjectInfoSelectorWidget/ProjectContributorsList.vue';

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
// Живой экран: перечитывается по ленте изменений Благороста вместо опроса по
// таймеру (набор таблиц — shared/lib/live).
useLiveReload(CAPITAL_LIVE_TABLES, reloadProjectData);

// Инициализация
onMounted(async () => {
  await loadProject();

});

// Останавливаем poll при уходе со страницы
</script>

<style lang="scss" scoped>
// Заполняет page-surface, чтобы список мог взять height: 100% и держать
// прокрутку внутри себя
.project-contributors-page {
  height: 100%;
  min-height: 100%;
}
</style>
