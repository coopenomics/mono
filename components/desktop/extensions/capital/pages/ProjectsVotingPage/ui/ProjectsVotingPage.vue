<template lang="pug">
//- Родитель «Голосования»: список на корне, деталь — child через router-view
//- (подсветка пункта меню через matched по name voting).
router-view(v-if='!isVotingRoot')
.voting-page(v-else)
  WindowLoader(v-show='isInitialLoading', text='Загрузка данных голосования...')
  .voting-page__body(v-show='!isInitialLoading')
    ListVotingProjectWidget(
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
import { ListVotingProjectWidget } from 'app/extensions/capital/widgets';

const router = useRouter();
const route = useRoute();
const { info } = useSystemStore();

const isVotingRoot = computed(() => route.name === 'voting');
const isInitialLoading = ref(true);

const handleOpenProject = (projectHash: string) => {
  router.push({
    name: 'voting-detail',
    params: { project_hash: projectHash },
    query: { _backRoute: 'voting' },
  });
};

const handleProjectsDataLoaded = () => {
  isInitialLoading.value = false;
};
</script>

<style lang="scss" scoped>
.voting-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  padding: var(--p-6);
  background: var(--p-surface);
  min-height: calc(100vh - var(--p-topbar-h));
  min-width: 0;
  box-sizing: border-box;
}

.voting-page__body {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  flex: 1;
  min-height: 0;
  min-width: 0;
}

@media (max-width: 768px) {
  .voting-page {
    padding: var(--p-4);
  }
}
</style>
