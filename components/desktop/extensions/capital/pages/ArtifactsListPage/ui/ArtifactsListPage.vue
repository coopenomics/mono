<template lang="pug">
.artifacts-list-page.page-shell
  .page-surface.list-surface.list-surface--fill
    // Скелетон первичной загрузки — как на проектах и компонентах
    .artifacts-skeleton(v-if='isInitialLoading')
      .skel(v-for='i in 8', :key='i')

    .artifacts-scroll-area(v-else-if='items.length')
      .row.items-center.artifact-row(
        v-for='story in items',
        :key='story._id',
        role='button',
        tabindex='0',
        @click='openStory(story)',
        @keydown.enter='openStory(story)'
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

    //- Пустое состояние — канон EmptyState по центру экрана
    .empty-fill(v-else)
      EmptyState(
        :title='$t("capital.artifactsListPage.emptyTitle")',
        :body='$t("capital.artifactsListPage.emptyBody")'
      )
        template(#icon)
          q-icon(name='article')

  //- Просмотр/правка — оверлей поверх списка (?story= в адресе), тот же,
  //- что на вкладках «Артефакты»: список не размонтируется, «назад»
  //- закрывает оверлей, ссылка на открытый артефакт пересылается
  RequirementOverlay(:items='items', @updated='onStoryUpdated')
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useLiveReload } from 'src/shared/lib/realtime';
import { CAPITAL_LIVE_TABLES } from 'app/extensions/capital/shared/lib/live';
import { Zeus } from '@coopenomics/sdk';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert } from 'src/shared/api';
import { EmptyState } from 'src/shared/ui/base';
import { useQueryOverlay } from 'src/shared/lib/navigation';
import { api as StoryApi } from 'app/extensions/capital/entities/Story/api';
import type { IStory } from 'app/extensions/capital/entities/Story/model';
import { FavoriteStarButton } from 'app/extensions/capital/features/Favorite/ToggleFavorite';
import { RequirementOverlay } from 'app/extensions/capital/features/Story/EditRequirement';
import { storyContentIcon } from 'app/extensions/capital/shared/lib/storyContentIcon';
import { t } from '../../../i18n';

const FavoriteTargetType = Zeus.CapitalFavoriteTargetType;

const { info } = useSystemStore();

// Бэкенд отдаёт только артефакты в границах допуска пайщика
// (совет — всё, остальные — свои проекты, допуски и свободные задачи)
const loading = ref(false);
const items = ref<IStory[]>([]);

// Скелетон только при первичной загрузке — как на проектах и компонентах
const isInitialLoading = computed(() => loading.value && items.value.length === 0);

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
    FailAlert(t('capital.artifactsListPage.loadError') + msg);
  } finally {
    loading.value = false;
  }
}

// Артефакты живут по ленте изменений Благороста.
useLiveReload(CAPITAL_LIVE_TABLES, () => load());

onMounted(load);

// --- Открытие артефакта: оверлей сам загружает данные и выясняет право
// на правку от проекта-владельца (см. RequirementOverlay)

const overlay = useQueryOverlay('story');

function openStory(story: IStory): void {
  overlay.open(story.story_hash);
}

function onStoryUpdated(updated: IStory): void {
  items.value = items.value.map((s) => (s.story_hash === updated.story_hash ? updated : s));
}
</script>

<style lang="scss" scoped>
// Высоту экрана задаёт канон-оболочка .page-shell; список забирает остаток
.artifacts-list-page {
  display: flex;
  flex-direction: column;
}

.list-surface,
.page-surface {
  background: var(--p-surface);
}

.list-surface--fill {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.artifacts-scroll-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0;
}

// Скелетон первичной загрузки — строки повторяют высоту строк списка
.artifacts-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  padding: var(--p-4);
  background: var(--p-surface);

  .skel {
    height: var(--p-7);
  }
}

.artifact-row {
  padding: var(--p-3);
  min-height: 48px;
  border-bottom: 1px solid var(--p-line);
  cursor: pointer;
  transition: background var(--p-dur-fast);
}

.artifact-row:hover {
  background: var(--p-surface-2);
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
