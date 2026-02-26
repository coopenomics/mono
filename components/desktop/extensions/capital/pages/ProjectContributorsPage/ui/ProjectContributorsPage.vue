<template lang="pug">
div
  // Список участников
  ProjectContributorsList(:project='project')
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';
import { useProjectLoader } from 'app/extensions/capital/entities/Project/model';
import ProjectContributorsList from 'app/extensions/capital/widgets/ProjectInfoSelectorWidget/ProjectContributorsList.vue';
import { useGraphqlSubscription, buildSubscriptionQuery } from 'src/shared/lib/composables';

const { project, loadProject } = useProjectLoader();

useGraphqlSubscription({
  query: buildSubscriptionQuery('capitalDataChanged', null, ['entity', 'action']),
  onData: () => { loadProject(); },
});

onMounted(async () => {
  await loadProject();
});
</script>

<style lang="scss" scoped>
</style>
