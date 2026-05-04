<template lang="pug">
div.column.flex-1.min-h-0.min-w-0.no-wrap
  // Мобильный layout - колонки одна под другой
  div(v-if="isMobileLayout").column.col.flex-1.min-h-0.min-w-0
    div.q-px-md.q-pt-md(v-if="issue")
      ProjectPathWidget.capital-entity-header-path(
        v-if="parentProject"
        :project="parentProject"
      )
      IssueTitleEditor(
        :issue="issue"
        @field-change="handleFieldChange"
        @update:title="handleTitleUpdate"
      ).full-width.q-mt-xs
        template(#prepend-icon)
          q-icon(name='task', size='24px', color='primary')
    div
      IssueSidebarWidget(
        v-if="issue"
        :issue="issue"
        :permissions="issue.permissions"
        :project-hash="projectHash"
        :parent-project-hash="parentProjectHash"
        :logs-refresh-trigger="logsRefreshTrigger"
        compact-mobile
        @update:status="handleStatusUpdate"
        @update:priority="handlePriorityUpdate"
        @update:estimate="handleEstimateUpdate"
        @update:labels="handleLabelsUpdate"
        @creators-set="handleCreatorsSet"
        @issue-updated="handleIssueUpdated"
        @issue-deleted="handleIssueDeleted"
        @issue-moved="handleIssueMoved"
      )

    div.col.flex-1.min-h-0.min-w-0.column.overflow-hidden
      div.col.min-h-0.overflow-auto.q-pt-md.min-w-0
        .row.items-center.q-gutter-md.q-mb-sm.q-px-md.q-pb-sm
          .col.min-w-0
            AutoSaveIndicator(
              :is-auto-saving="isAutoSaving"
              :auto-save-error="autoSaveError"
            )
            Editor(
              v-if="issue"
              v-model='issue.description',
              label='Описание задачи',
              placeholder='Опишите задачу подробно...',
              :readonly="!issue.permissions?.can_edit_issue",
              :padded="false"
              @change='handleDescriptionChange'
            )

        IssueLinkedGitCommitsWidget.q-px-md.q-mt-md(
          v-if='linkedGitCommits.length'
          :commits='linkedGitCommits'
        )

        q-expansion-item.q-px-md.q-mt-md(
          v-if='issue'
          icon='assignment'
          label='Требования к задаче'
          :caption='requirementsCaption'
          header-class='text-grey-7'
          dense-toggle
          default-opened
        )
          RequirementsListWidget(
            :filter='requirementsFilter'
            :max-items='50'
            :permissions='issue.permissions'
          )
          .row.justify-end.q-mt-sm(v-if='canCreateRequirement')
            q-btn(
              flat
              dense
              no-caps
              color='primary'
              icon='add'
              label='Добавить требование'
              @click='openCreateRequirementDialog'
            )

        q-expansion-item.q-px-md.q-mt-md(
          v-if='issue'
          icon='schedule'
          label='История рабочего времени'
          :caption='worklogCaption'
          header-class='text-grey-7'
          dense-toggle
        )
          TimeEntriesWidget(
            :issue-hash='issue.issue_hash'
          )

  .column.flex-1.min-h-0.min-w-0.no-wrap(v-else)
    .q-px-md.q-pt-md(v-if="issue")
      ProjectPathWidget.capital-entity-header-path(
        v-if="parentProject"
        :project="parentProject"
      )
      IssueTitleEditor(
        :issue="issue"
        @field-change="handleFieldChange"
        @update:title="handleTitleUpdate"
      ).full-width.q-mt-xs
        template(#prepend-icon)
          q-icon(name='task', size='24px', color='primary')
    q-splitter.col.flex-1.min-h-0(
      v-model="sidebarWidth"
      :limits="[200, 800]"
      unit="px"
      separator-class="bg-grey-3"
      before-class="column no-wrap min-h-0 overflow-y-auto"
      after-class="min-h-0"
      @update:model-value="saveSidebarWidth"
    )
      template(#before)
        IssueSidebarWidget(
          v-if="issue"
          :issue="issue"
          :permissions="issue.permissions"
          :project-hash="projectHash"
          :parent-project-hash="parentProjectHash"
          :logs-refresh-trigger="logsRefreshTrigger"
          @update:status="handleStatusUpdate"
          @update:priority="handlePriorityUpdate"
          @update:estimate="handleEstimateUpdate"
          @update:labels="handleLabelsUpdate"
          @creators-set="handleCreatorsSet"
          @issue-updated="handleIssueUpdated"
          @issue-deleted="handleIssueDeleted"
          @issue-moved="handleIssueMoved"
        )

      template(#after)
        div.column.full-height.min-h-0
          div.col.min-h-0.overflow-auto.q-pt-md.min-w-0
            .row.items-center.q-gutter-md.q-mb-sm.q-px-md.q-pb-sm
              .col.min-w-0
                AutoSaveIndicator(
                  :is-auto-saving="isAutoSaving"
                  :auto-save-error="autoSaveError"
                )

                Editor(
                  v-if="issue"
                  v-model='issue.description',
                  label='Описание задачи',
                  placeholder='Опишите задачу подробно...',
                  :readonly="!issue.permissions?.can_edit_issue",
                  :padded="false"
                  @change='handleDescriptionChange'
                )

            IssueLinkedGitCommitsWidget.q-px-md.q-mt-md(
              v-if='linkedGitCommits.length'
              :commits='linkedGitCommits'
            )

            q-expansion-item.q-px-md.q-mt-md(
              v-if='issue'
              icon='assignment'
              label='Требования к задаче'
              :caption='requirementsCaption'
              header-class='text-grey-7'
              dense-toggle
              default-opened
            )
              RequirementsListWidget(
                :filter='requirementsFilter'
                :max-items='50'
                :permissions='issue.permissions'
              )
              .row.justify-end.q-mt-sm(v-if='canCreateRequirement')
                q-btn(
                  flat
                  dense
                  no-caps
                  color='primary'
                  icon='add'
                  label='Добавить требование'
                  @click='openCreateRequirementDialog'
                )

            q-expansion-item.q-px-md.q-mt-md(
              v-if='issue'
              icon='schedule'
              label='История рабочего времени'
              :caption='worklogCaption'
              header-class='text-grey-7'
              dense-toggle
            )
              TimeEntriesWidget(
                :issue-hash='issue.issue_hash'
              )

  CreateRequirementWithEditorDialog(
    ref='createRequirementDialog'
    :filter='createRequirementFilter'
    @success='handleRequirementCreated'
  )
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useWindowSize } from 'src/shared/hooks/useWindowSize';
import { FailAlert } from 'src/shared/api';
import { api as IssueApi } from 'app/extensions/capital/entities/Issue/api';
import { api as ProjectApi } from 'app/extensions/capital/entities/Project/api';
import type { IIssue } from 'app/extensions/capital/entities/Issue/model';
import type { IProject } from 'app/extensions/capital/entities/Project/model';
import { EMPTY_HASH } from 'src/shared/lib/consts';
import { useBackButton } from 'src/shared/lib/navigation';
import { Editor, AutoSaveIndicator } from 'src/shared/ui';
import { toMarkdown } from 'src/shared/lib/utils';
import { useUpdateIssue } from 'app/extensions/capital/features/Issue/UpdateIssue';
import { IssueSidebarWidget, IssueLinkedGitCommitsWidget, TimeEntriesWidget } from 'app/extensions/capital/widgets';
import { IssueTitleEditor } from 'app/extensions/capital/widgets/IssueTitleEditor';
import { ProjectPathWidget } from 'app/extensions/capital/widgets/ProjectPathWidget';
import { RequirementsListWidget } from 'app/extensions/capital/widgets/RequirementsListWidget';
import { CreateRequirementWithEditorDialog } from 'app/extensions/capital/features/Story/CreateStory';
import { useStoryStore, type IGetStoriesInput } from 'app/extensions/capital/entities/Story/model';

const route = useRoute();
const router = useRouter();

// Используем Quasar и window size для определения размера экрана
const { isMobile } = useWindowSize();

const issue = ref<IIssue | null>(null);
const loading = ref(false);

// Информация о родительском элементе (компонент-контейнер задачи)
const parentProject = ref<IProject | null>(null);

// Триггер для обновления логов задачи
const logsRefreshTrigger = ref(0);

// Управление шириной sidebar
const SIDEBAR_WIDTH_KEY = 'sidebar-width';
const DEFAULT_SIDEBAR_WIDTH = 300;

// Reactive переменная для ширины sidebar
const sidebarWidth = ref(DEFAULT_SIDEBAR_WIDTH);

// Загрузка ширины sidebar из localStorage
const loadSidebarWidth = () => {
  const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
  if (saved) {
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed) && parsed >= 200 && parsed <= 800) {
      sidebarWidth.value = parsed;
    }
  }
};

// Сохранение ширины sidebar в localStorage
const saveSidebarWidth = (width: number) => {
  localStorage.setItem(SIDEBAR_WIDTH_KEY, width.toString());
};

// Определение layout в зависимости от размера экрана
const isMobileLayout = isMobile;

// Используем composable для обновления задач
const { debounceSave, isAutoSaving, autoSaveError } = useUpdateIssue();

// Получаем параметры из маршрута
const issueHash = computed(() => route.params.issue_hash as string);
const projectHash = computed(() => route.params.project_hash as string);
const parentHash = computed(() => projectHash.value);

const linkedGitCommits = computed(() => issue.value?.linked_git_commits ?? []);

// Фильтр для виджета требований — story только этой задачи
const requirementsFilter = computed<Partial<IGetStoriesInput['filter']>>(() => ({
  issue_hash: issue.value?.issue_hash ?? '',
}));

// Фильтр для диалога создания — issue_hash + project_hash родителя
const createRequirementFilter = computed(() => ({
  project_hash: projectHash.value,
  issue_hash: issue.value?.issue_hash ?? '',
}));

// Право на создание требования к задаче
const canCreateRequirement = computed((): boolean => {
  return Boolean(issue.value?.permissions?.can_create_requirement);
});

// Подпись рядом с заголовком «Требования к задаче»
const storyStore = useStoryStore();
const requirementsCaption = computed(() => {
  const stored = storyStore.stories;
  const cur = issue.value?.issue_hash;
  if (!cur || !stored) return '';
  const count = stored.items.filter((s) => s.issue_hash === cur).length;
  if (count === 0) return 'пока пусто';
  return `${count} шт.`;
});

const createRequirementDialog = ref<InstanceType<typeof CreateRequirementWithEditorDialog> | null>(null);
const openCreateRequirementDialog = () => {
  createRequirementDialog.value?.openDialog();
};
const handleRequirementCreated = () => {
  // RequirementsListWidget сам подцепит новый story через store
};

// Подпись рядом с заголовком «История рабочего времени» — отражает факт/план одной строкой.
const worklogCaption = computed(() => {
  const fact = issue.value?.fact ?? 0;
  const estimate = issue.value?.estimate ?? 0;
  const format = (h: number) => {
    if (h <= 0) return '0ч';
    if (h < 8) {
      const rounded = h % 1 === 0 ? h : parseFloat(h.toFixed(2));
      return `${rounded}ч`;
    }
    return `${Math.round((h / 8) * 10) / 10}д`;
  };
  if (fact <= 0 && estimate <= 0) return 'записей пока нет';
  if (estimate <= 0) return `отработано ${format(fact)}`;
  return `${format(fact)} из ${format(estimate)}`;
});

/** parent_hash родительского проекта — перенос задачи только между компонентами этого проекта */
const parentProjectHash = computed(() => {
  const p = parentProject.value?.parent_hash?.trim();
  if (!p || p === EMPTY_HASH) return null;
  return p;
});

const routeIssueKey = computed(
  () => `${String(route.params.issue_hash)}:${String(route.params.project_hash)}`,
);

// Проверяем и конвертируем описание в Markdown формат если необходимо
const ensureMarkdownFormat = (description: any) => {
  if (!description) return '';

  // Используем универсальную утилиту конвертации
  return toMarkdown(description);
};

// Загрузка информации о родительском элементе
const loadParentInfo = async () => {
  try {
    const projectData = await ProjectApi.loadProject({
      hash: parentHash.value,
    });

    if (projectData) {
      parentProject.value = projectData;
    } else {
      parentProject.value = null;
    }
  } catch (error) {
    console.error('Ошибка при загрузке информации о родителе:', error);
    parentProject.value = null;
  }
};

// Обработчик изменения полей
const handleFieldChange = () => {
  // Просто триггер реактивности для computed hasChanges в виджетах
};

// Обработчик обновления названия задачи
const handleTitleUpdate = async (value: string) => {
  if (issue.value) {
    issue.value.title = value;

    // Отправляем мутацию на обновление названия
    const updateData = {
      issue_hash: issue.value.issue_hash,
      title: value,
    };

    try {
      await debounceSave(updateData, projectHash.value);
      // Обновляем логи после успешного сохранения
      logsRefreshTrigger.value++;
    } catch (error) {
      console.error('Failed to update title:', error);
    }
  }
};

// Обработчик изменения описания задачи
const handleDescriptionChange = async () => {
  if (!issue.value) return;

  const updateData = {
    issue_hash: issue.value.issue_hash,
    description: issue.value.description,
  };

  try {
    // Запускаем авто-сохранение с задержкой
    await debounceSave(updateData, projectHash.value);
    // Обновляем логи после успешного сохранения
    logsRefreshTrigger.value++;
  } catch (error) {
    console.error('Failed to update description:', error);
  }
};

// Убрали правый drawer - StoriesWidget теперь в сайдбаре

// Настраиваем кнопку "Назад"
useBackButton({
  text: 'Назад',
  componentId: 'issue-page-' + issueHash.value,
  onClick: () => {
    const backRoute = route.query._backRoute as string;
    if (backRoute) {
      // Проверяем, является ли backRoute ключом sessionStorage
      const storedRoute = sessionStorage.getItem(backRoute);
      if (storedRoute) {
        try {
          const routeData = JSON.parse(storedRoute);
          router.push({
            name: routeData.name,
            params: routeData.params,
            query: routeData.query
          });
          // Очищаем сохраненные данные
          sessionStorage.removeItem(backRoute);
          return;
        } catch (error) {
          console.warn('Failed to parse stored route:', error);
        }
      }
      // Если это обычное название маршрута, переходим стандартно
      router.push({ name: backRoute });
    } else {
      router.back();
    }
  }
});

// Загрузка задачи
const loadIssue = async () => {
  loading.value = true;
  try {
    console.log('Загрузка задачи:', issueHash.value);

    // Получаем задачу по HASH
    const issueData = await IssueApi.loadIssue({
      issue_hash: issueHash.value,
    });

    issue.value = issueData || null;

    // Конвертируем описание в Markdown формат если необходимо
    if (issue.value?.description) {
      issue.value.description = ensureMarkdownFormat(issue.value.description);
    }
  } catch (error) {
    console.error('Ошибка при загрузке задачи:', error);
    FailAlert('Не удалось загрузить задачу');
  } finally {
    loading.value = false;
  }
};

// Обработчики обновления полей задачи
const handleStatusUpdate = (value: any) => {
  if (issue.value) {
    issue.value.status = value;
    // Обновляем логи после изменения статуса
    logsRefreshTrigger.value++;
  }
};

const handlePriorityUpdate = (value: any) => {
  if (issue.value) {
    issue.value.priority = value;
    // Обновляем логи после изменения приоритета
    logsRefreshTrigger.value++;
  }
};

const handleEstimateUpdate = (value: number) => {
  if (issue.value) {
    issue.value.estimate = value;
    // Обновляем логи после изменения оценки
    logsRefreshTrigger.value++;
  }
};

const handleLabelsUpdate = (value: string[]) => {
  if (!issue.value) return;
  const prev = issue.value.metadata;
  const base: Record<string, unknown> =
    prev && typeof prev === 'object' && prev !== null && !Array.isArray(prev)
      ? { ...(prev as Record<string, unknown>) }
      : {};
  base.labels = value;
  issue.value.metadata = base as IIssue['metadata'];
  logsRefreshTrigger.value++;
};

const handleCreatorsSet = (creators: any[]) => {
  if (issue.value) {
    // Обновляем список создателей в локальном состоянии
    issue.value.creators = creators.map(c => c.username);
    // Обновляем логи после изменения ответственных
    logsRefreshTrigger.value++;
  }
};

const handleIssueUpdated = (updatedIssue: any) => {
  if (updatedIssue && issue.value) {
    // Обновляем локальную задачу обновленными данными
    issue.value = { ...issue.value, ...updatedIssue };
  }
};

const handleIssueDeleted = () => {
  const coopname = route.params.coopname as string;
  router.push({
    name: 'component-tasks',
    params: {
      coopname,
      project_hash: projectHash.value,
    },
  });
};

const handleIssueMoved = ({
  updatedIssue,
  toProjectHash,
}: {
  updatedIssue: IIssue;
  fromProjectHash: string;
  toProjectHash: string;
}) => {
  const coopname = route.params.coopname as string;
  void router.replace({
    name: 'component-issue',
    params: {
      coopname,
      project_hash: toProjectHash,
      issue_hash: updatedIssue.issue_hash,
    },
    query: { ...route.query },
  });
};

watch(
  routeIssueKey,
  async (_key, prev) => {
    if (prev === undefined) return;
    await loadParentInfo();
    await loadIssue();
  },
);

// Инициализация
onMounted(async () => {
  // Загружаем сохраненную ширину sidebar
  loadSidebarWidth();

  // Загружаем информацию о родителе
  await loadParentInfo();

  // Загружаем задачу
  await loadIssue();
});
</script>

<style lang="scss" scoped>
</style>
