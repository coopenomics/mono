<template lang="pug">
//- Шапки у DetailsDrawer нет намеренно (нет title/closable/actions):
//- у панели артефакта своя шапка с заголовком и крестиком в варианте dialog
DetailsDrawer(
  :model-value='overlay.isOpen.value',
  :width='760',
  :closable='false',
  @update:model-value='(v) => !v && overlay.close()'
)
  .requirement-overlay__body(v-if='story')
    EditRequirementPanel(
      :key='story.story_hash',
      variant='dialog',
      :requirement='story',
      :canEdit='resolvedCanEdit',
      @close='overlay.close()',
      @updated='onUpdated'
    )
  .requirement-overlay__loading(v-else)
    q-spinner(size='28px', color='primary')
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQueryOverlay } from 'src/shared/lib/navigation';
import { FailAlert } from 'src/shared/api';
import { DetailsDrawer } from 'src/shared/ui/domain';
import { api as StoryApi } from 'app/extensions/capital/entities/Story/api';
import { api as IssueApi } from 'app/extensions/capital/entities/Issue/api';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import type { IStory } from 'app/extensions/capital/entities/Story/model';
import EditRequirementPanel from './EditRequirementPanel.vue';

/**
 * Артефакт в оверлее поверх текущей страницы.
 *
 * Открытая сущность живёт в адресе (`?story=<hash>`, см. useQueryOverlay):
 * страница под оверлеем не размонтируется — список сохраняет скролл и ленту,
 * «назад» закрывает оверлей, ссылка пересылается, F5 восстанавливает.
 * Хост только зовёт `open(hash)` и слушает `updated` — загрузка артефакта и
 * права оверлей разрешает сам.
 */
const props = defineProps<{
  /** Уже загруженные артефакты хоста — чтобы не ходить за тем, что на экране */
  items?: IStory[];
  /** Право правки, если хост его уже знает; иначе оверлей выяснит сам */
  canEdit?: boolean;
}>();

const emit = defineEmits<{
  updated: [requirement: IStory];
}>();

const overlay = useQueryOverlay('story');
const projectStore = useProjectStore();

const story = ref<IStory | null>(null);
const resolvedCanEdit = ref(false);

async function resolveOwnerProjectHash(s: IStory): Promise<string | undefined> {
  if (s.issue_hash) {
    try {
      const issue = await IssueApi.loadIssue({ issue_hash: s.issue_hash });
      if (issue?.project_hash) return issue.project_hash;
    } catch {
      // остаёмся на project_hash самого артефакта
    }
  }
  return s.project_hash ?? undefined;
}

// Право подтягивается после открытия — просмотр не ждёт загрузки проекта
async function resolveCanEdit(s: IStory): Promise<void> {
  if (props.canEdit !== undefined) {
    resolvedCanEdit.value = props.canEdit;
    return;
  }
  try {
    const ownerHash = await resolveOwnerProjectHash(s);
    if (!ownerHash) return;
    const project = await projectStore.loadProject({ hash: ownerHash });
    if (story.value?.story_hash === s.story_hash) {
      resolvedCanEdit.value = project?.permissions?.can_edit_requirement ?? false;
    }
  } catch {
    // без прав остаёмся в режиме просмотра
  }
}

watch(
  overlay.value,
  async (hash) => {
    if (!hash) {
      story.value = null;
      return;
    }
    resolvedCanEdit.value = props.canEdit ?? false;
    const local = props.items?.find((s) => s.story_hash === hash);
    if (local) {
      story.value = local;
    } else {
      // Прямой заход по ссылке или сущность вне загруженной ленты
      story.value = null;
      try {
        const row = await StoryApi.loadStory({ story_hash: hash });
        if (!row) {
          FailAlert('Артефакт не найден или недоступен');
          overlay.close();
          return;
        }
        story.value = row;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        FailAlert('Не удалось загрузить артефакт: ' + msg);
        overlay.close();
        return;
      }
    }
    if (story.value) void resolveCanEdit(story.value);
  },
  { immediate: true },
);

function onUpdated(updated: IStory): void {
  story.value = updated;
  emit('updated', updated);
}
</script>

<style lang="scss" scoped>
.requirement-overlay__body {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1 1 auto;
}

.requirement-overlay__loading {
  display: grid;
  place-items: center;
  padding: var(--p-8) 0;
}
</style>
