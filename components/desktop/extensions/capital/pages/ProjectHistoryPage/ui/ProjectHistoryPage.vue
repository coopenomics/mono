<template lang="pug">
ProjectLogsTableWidget(
  :project-hash="projectHash"
  :show-components-logs="true"
  :title="$t('capital.projectHistoryPage.title')"
)
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { ProjectLogsTableWidget } from 'app/extensions/capital/widgets/ProjectLogsTableWidget';

const route = useRoute();

// Получаем hash проекта из параметров маршрута
const projectHash = computed(() => route.params.project_hash as string);
</script>

<style lang="scss" scoped>
</style>
