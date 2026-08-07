<template lang="pug">
q-page.requirement-detail-page(padding).column.no-wrap
  .flex.flex-center.q-pa-lg(v-if='loading')
    q-spinner(color='primary' size='40px')
  q-banner.q-ma-md(v-else-if='loadError' rounded dense class='bg-negative text-white')
    | {{ loadError }}
  .column.col(v-else-if='story && permissionsLoaded' style='flex: 1 1 auto; min-height: 0')
    EditRequirementPanel(
      ref='panelRef'
      variant='page'
      :requirement='story'
      :canEdit='canEdit'
      @updated='onUpdated'
    )
      template(#toolbar-leading)
        q-btn(
          flat
          color='primary'
          icon='arrow_back'
          label='К списку'
          @click='onBackToList'
        )
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api as StoryApi } from 'app/extensions/capital/entities/Story/api';
import { api as IssueApi } from 'app/extensions/capital/entities/Issue/api';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import type { IStory } from 'app/extensions/capital/entities/Story/model';
import type { IProjectPermissions } from 'app/extensions/capital/entities/Project/model';
import { EditRequirementPanel } from 'app/extensions/capital/features/Story/EditRequirement';
import { useCapitalWorkspaceRoutes } from 'app/extensions/capital/shared/lib';

type PanelExposed = {
  tryNavigateAway?: () => boolean;
};

const route = useRoute();
const router = useRouter();
const projectStore = useProjectStore();
const { routeName } = useCapitalWorkspaceRoutes();

const loading = ref(true);
const loadError = ref('');
const story = ref<IStory | null>(null);
const projectPermissions = ref<IProjectPermissions | null>(null);
const permissionsLoaded = ref(false);
const panelRef = ref<PanelExposed | null>(null);

const projectHash = computed(() => route.params.project_hash as string);
const storyHash = computed(() => route.params.story_hash as string);

const canEdit = computed(() => projectPermissions.value?.can_edit_requirement ?? false);

const listRouteName = computed(() => {
  const name = String(route.name ?? '');
  if (name.endsWith('component-requirement-detail')) {
    return routeName('component-requirements');
  }
  return routeName('project-requirements');
});

const goToList = () => {
  void router.push({
    name: listRouteName.value,
    params: { project_hash: projectHash.value },
  });
};

const onBackToList = () => {
  const leave = panelRef.value?.tryNavigateAway?.() ?? true;
  if (!leave) {
    return;
  }
  goToList();
};

/** Проект, к которому привязан артефакт (с учётом задачи). */
const resolveStoryProjectHash = async (row: IStory): Promise<string | undefined> => {
  if (row.issue_hash) {
    try {
      const issue = await IssueApi.loadIssue({ issue_hash: row.issue_hash });
      if (issue?.project_hash) return issue.project_hash;
    } catch {
      // остаёмся на project_hash строки артефакта
    }
  }
  return row.project_hash ?? undefined;
};

/** Артефакт относится к контексту, если его проект — сам контекст или потомок по parent_hash. */
const isStoryUnderProjectContext = async (
  contextProjectHash: string,
  storyProjectHash: string | undefined,
): Promise<boolean> => {
  if (!storyProjectHash) return false;
  const seen = new Set<string>();
  let h: string | undefined = storyProjectHash;
  while (h && !seen.has(h)) {
    seen.add(h);
    if (h === contextProjectHash) return true;
    const proj = await projectStore.loadProject({ hash: h });
    const parent = proj?.parent_hash;
    if (!parent || typeof parent !== 'string') break;
    h = parent;
  }
  return false;
};

const belongsToProjectContext = async (row: IStory, expectedProjectHash: string): Promise<boolean> => {
  const target = await resolveStoryProjectHash(row);
  return isStoryUnderProjectContext(expectedProjectHash, target);
};

const load = async () => {
  loading.value = true;
  loadError.value = '';
  story.value = null;
  permissionsLoaded.value = false;
  try {
    const row = await StoryApi.loadStory({ story_hash: storyHash.value });
    if (!row) {
      loadError.value = 'Артефакт не найден';
      return;
    }
    const ok = await belongsToProjectContext(row, projectHash.value);
    if (!ok) {
      loadError.value = 'Артефакт не относится к этому проекту';
      return;
    }
    story.value = row;

    const proj = await projectStore.loadProject({ hash: projectHash.value });
    projectPermissions.value = proj?.permissions ?? null;

  } catch (e) {
    console.error(e);
    loadError.value = 'Не удалось загрузить артефакт';
  } finally {
    permissionsLoaded.value = true;
    loading.value = false;
  }
};

const onUpdated = (updated: IStory) => {
  story.value = updated;
};

watch([projectHash, storyHash], () => {
  void load();
});

onMounted(() => {
  void load();
});
</script>

<style lang="scss" scoped>
/*
  Вложенный q-page под router-view: родительский q-page в layout не задаёт flex-высоту,
  поэтому опираемся на вьюпорт, чтобы карточка и BPMN могли занять оставшееся место.
*/
.requirement-detail-page {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: calc(100dvh - 56px);
  min-height: calc(100vh - 56px);
}
</style>
