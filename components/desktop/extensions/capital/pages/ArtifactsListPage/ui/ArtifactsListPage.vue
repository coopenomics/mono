<template lang="pug">
.artifacts-list-page
  .page-surface.list-surface.list-surface--fill
    .artifacts-scroll-area
      template(v-if='items.length')
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

      .artifacts-loading(v-else-if='loading')
        q-spinner(size='24px')

      .list-empty(v-else)
        q-icon(name='inbox', size='20px')
        span Нет доступных артефактов

  //- Просмотр/правка — полноэкранный диалог, тот же, что на вкладках «Артефакты»
  EditRequirementDialog(
    ref='editDialogRef',
    :requirement='selectedStory',
    :can-edit='selectedCanEdit',
    @updated='onStoryUpdated'
  )
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert } from 'src/shared/api';
import { api as StoryApi } from 'app/extensions/capital/entities/Story/api';
import { api as IssueApi } from 'app/extensions/capital/entities/Issue/api';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import type { IStory } from 'app/extensions/capital/entities/Story/model';
import { FavoriteStarButton } from 'app/extensions/capital/features/Favorite/ToggleFavorite';
import { EditRequirementDialog } from 'app/extensions/capital/features/Story/EditRequirement';
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

// --- Открытие артефакта: полноэкранный диалог, право на правку — от проекта-владельца

const projectStore = useProjectStore();
const editDialogRef = ref<{ openDialog: () => void } | null>(null);
const selectedStory = ref<IStory | null>(null);
const selectedCanEdit = ref(false);

async function resolveOwnerProjectHash(story: IStory): Promise<string | undefined> {
  if (story.issue_hash) {
    try {
      const issue = await IssueApi.loadIssue({ issue_hash: story.issue_hash });
      if (issue?.project_hash) return issue.project_hash;
    } catch {
      // остаёмся на project_hash самого артефакта
    }
  }
  return story.project_hash ?? undefined;
}

function openStory(story: IStory): void {
  selectedStory.value = story;
  selectedCanEdit.value = false;
  editDialogRef.value?.openDialog();
  // Право подтягивается после открытия — просмотр не ждёт загрузки проекта
  void (async () => {
    try {
      const ownerHash = await resolveOwnerProjectHash(story);
      if (!ownerHash) return;
      const project = await projectStore.loadProject({ hash: ownerHash });
      if (selectedStory.value?.story_hash === story.story_hash) {
        selectedCanEdit.value = project?.permissions?.can_edit_requirement ?? false;
      }
    } catch {
      // без прав остаёмся в режиме просмотра
    }
  })();
}

function onStoryUpdated(updated: IStory): void {
  selectedStory.value = updated;
  items.value = items.value.map((s) => (s.story_hash === updated.story_hash ? updated : s));
}
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
