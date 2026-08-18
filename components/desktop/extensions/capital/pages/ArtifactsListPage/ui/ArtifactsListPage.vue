<template lang="pug">
.artifacts-list-page
  .page-surface.list-surface.list-surface--fill
    .artifacts-scroll-area
      template(v-if='items.length')
        .row.items-center.artifact-row(
          v-for='story in items',
          :key='story._id'
        )
          // Избранное — слева, до иконки типа и наименования
          .col-auto.row-favorite
            FavoriteStarButton(
              :target-type='FavoriteTargetType.ARTIFACT',
              :target-hash='story.story_hash'
            )
          .col-auto.artifact-row__icon
            q-icon(:name='storyContentIcon(story)', size='sm')
          .col.artifact-row__title-col
            span.list-item-title {{ story.title }}

      .artifacts-loading(v-else-if='loading')
        q-spinner(size='24px')

      .list-empty(v-else)
        q-icon(name='inbox', size='20px')
        span Нет доступных артефактов
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert } from 'src/shared/api';
import { api as StoryApi } from 'app/extensions/capital/entities/Story/api';
import type { IStory } from 'app/extensions/capital/entities/Story/model';
import { FavoriteStarButton } from 'app/extensions/capital/features/Favorite/ToggleFavorite';
import { storyContentIcon } from 'app/extensions/capital/shared/lib/storyContentIcon';

const FavoriteTargetType = Zeus.CapitalFavoriteTargetType;

const { info } = useSystemStore();

// Бэкенд отдаёт только артефакты в границах допуска пайщика
// (совет — всё, остальные — свои проекты, допуски и свободные задачи)
const loading = ref(false);
const items = ref<IStory[]>([]);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const result = await StoryApi.loadStories({
      filter: { coopname: info.coopname },
      options: { page: 1, limit: 200, sortBy: '_created_at', sortOrder: 'DESC' },
    });
    items.value = result.items;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    FailAlert('Не удалось загрузить артефакты: ' + msg);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style lang="scss" scoped>
.artifacts-list-page {
  height: 100%;
  min-height: 100%;
}

.list-surface,
.page-surface {
  background: var(--p-surface);
}

.list-surface--fill {
  height: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.artifacts-scroll-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0;
}

.artifacts-loading {
  display: flex;
  justify-content: center;
  padding: var(--p-5);
  color: var(--p-ink-3);
}

.artifact-row {
  padding: var(--p-3);
  min-height: 48px;
  border-bottom: 1px solid var(--p-line);
}

.artifact-row__icon {
  width: 32px;
  flex-shrink: 0;
  color: var(--p-ink-2);
}

.artifact-row__title-col {
  min-width: 0;
  word-wrap: break-word;
  white-space: normal;
}
</style>
