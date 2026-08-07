<template lang="pug">
//- Родитель «Результаты»: список на корне, деталь — child через router-view
router-view(v-if='!isResultsRoot')
.results-page(v-else)
  WindowLoader(v-show='isInitialLoading', text='Загрузка данных результатов...')
  .results-page__body(v-show='!isInitialLoading')
    ListResultProjectsWidget(
      :coopname='info.coopname',
      @open-project='handleOpenProject',
      @data-loaded='handleProjectsDataLoaded'
    )
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { WindowLoader } from 'src/shared/ui/Loader';
import { ListResultProjectsWidget } from 'app/extensions/capital/widgets';

const router = useRouter();
const route = useRoute();
const { info } = useSystemStore();

const isResultsRoot = computed(() => route.name === 'results');
const isInitialLoading = ref(true);

const handleOpenProject = (projectHash: string) => {
  router.push({
    name: 'results-detail',
    params: { project_hash: projectHash },
    query: { _backRoute: 'results' },
  });
};

const handleProjectsDataLoaded = () => {
  isInitialLoading.value = false;
};
</script>

<style lang="scss" scoped>
.results-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  padding: var(--p-6);
  background: var(--p-surface);
  min-height: calc(100vh - var(--p-topbar-h));
  min-width: 0;
  box-sizing: border-box;
}

.results-page__body {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  flex: 1;
  min-height: 0;
  min-width: 0;
}

@media (max-width: 768px) {
  .results-page {
    padding: var(--p-4);
  }
}
</style>
