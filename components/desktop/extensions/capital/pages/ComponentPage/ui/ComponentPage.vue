<template lang="pug">
div.column.flex-1.min-h-0.min-w-0.no-wrap
  // Меню вкладок — сразу под шапкой, без внешних отступов
  PageTabs(
    v-if="project && !isIssueRoute"
    :tabs="componentTabs"
    :active-key="activeTabKey"
  )
    template(#actions)
      PendingClearanceButton(
        v-if="project.permissions?.pending_clearance && !project.permissions?.has_clearance"
      )
      MakeClearanceButton(
        v-else-if="!project.permissions?.has_clearance"
        ref="makeClearanceRef"
        :project="project"
        @clearance-submitted="handleClearanceSubmitted"
      )
      template(v-else)
        CreateIssueButton(
          v-if="activeTabKey === 'component-tasks' && project.permissions?.can_manage_issues"
          ref="createIssueRef"
          :project-hash="projectHash"
          size="sm"
          label="Задача"
          @action-completed="handleIssueCreated"
        )
        CreateRequirementButton(
          v-if="activeTabKey === 'component-requirements'"
          ref="createRequirementRef"
          :filter="{ project_hash: projectHash }"
          :permissions="project.permissions"
          @action-completed="handleRequirementCreated"
        )
        SetPlanButton(
          v-if="activeTabKey === 'component-planning' && project.permissions?.can_set_plan"
          ref="setPlanRef"
          :project="project"
          @action-completed="handlePlanSet"
        )
        AddAuthorButton(
          v-if="activeTabKey === 'component-contributors' && project.permissions?.can_manage_authors"
          ref="addAuthorRef"
          :project="project"
          @authors-added="handleAuthorsAdded"
        )

  // Скелетон первичной загрузки компонента
  .component-page-skeleton(v-if="!project")
    .component-page-skeleton__side(v-if="showSidebar")
      .skel(v-for="i in 4", :key="i")
    .component-page-skeleton__main
      .skel.skel--title
      .skel.skel--text(v-for="i in 3", :key="i")

  // Мобильный layout — сайдбар только на «Описание»
  div.column.col.flex-1.min-h-0.min-w-0(
    v-else-if="isMobileLayout"
  )
    .q-px-md(v-if="showSidebar")
      ProjectTitleEditor(
        :project="project"
        label="Компонент"
        @field-change="handleFieldChange"
        @update:title="handleTitleUpdate"
      ).full-width
        template(#prepend-icon)
          q-icon(name='code', size='24px', color='primary')
        template(#hint)
          ComponentToProjectPathWidget(:project="project")
      ComponentSidebarWidget(
        :project="project"
        compact-mobile
        @project-deleted="handleProjectDeleted"
      )
    div.col.flex-1.min-h-0.min-w-0.column.overflow-hidden.relative-position
      div.col.min-h-0.overflow-auto.min-w-0
        router-view

  // Десктоп «Описание»: название + сайдбар управления + контент
  div.column.col.flex-1.min-h-0.min-w-0(
    v-else-if="showSidebar"
  )
    .q-px-md
      ProjectTitleEditor(
        :project="project"
        label="Компонент"
        @field-change="handleFieldChange"
        @update:title="handleTitleUpdate"
      ).full-width
        template(#prepend-icon)
          q-icon(name='code', size='24px', color='primary')
        template(#hint)
          ComponentToProjectPathWidget(:project="project")
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
        ComponentSidebarWidget(
          :project="project"
          @project-deleted="handleProjectDeleted"
        )
      template(#after)
        div.column.full-height.min-h-0.relative-position
          div.col.min-h-0.overflow-auto.min-w-0
            router-view

  // Остальные вкладки — контент на всю ширину
  div.column.col.flex-1.min-h-0.min-w-0.relative-position(v-else)
    div.col.min-h-0.overflow-auto.min-w-0
      router-view
</template>
<script lang="ts" setup>
import { onMounted, computed, watch, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useWindowSize } from 'src/shared/hooks/useWindowSize';
import { useProjectLoader } from 'app/extensions/capital/entities/Project/model';
import { useBackButton } from 'src/shared/lib/navigation';
import { PageTabs } from 'src/shared/ui/layout';
import { CreateIssueButton } from 'app/extensions/capital/features/Issue/CreateIssue';
import { CreateRequirementButton } from 'app/extensions/capital/features/Story/CreateStory';
import { AddAuthorButton } from 'app/extensions/capital/features/Project/AddAuthor';
import { SetPlanButton } from 'app/extensions/capital/features/Project/SetPlan';
import { MakeClearanceButton } from 'app/extensions/capital/features/Contributor/MakeClearance';
import { PendingClearanceButton } from 'app/extensions/capital/shared/ui/PendingClearanceButton';
import { ComponentSidebarWidget } from 'app/extensions/capital/widgets';
import { ProjectTitleEditor } from 'app/extensions/capital/widgets/ProjectTitleEditor';
import { ComponentToProjectPathWidget } from 'app/extensions/capital/widgets/ComponentToProjectPathWidget';
import { useCapitalFabHotkeys } from 'app/extensions/capital/shared/lib';

// Используем window size для определения размера экрана
const { isMobile } = useWindowSize();

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

type CapitalActionOpen = { openDialog: () => void } | null;

const createIssueRef = ref<CapitalActionOpen>(null);
const createRequirementRef = ref<CapitalActionOpen>(null);
const setPlanRef = ref<CapitalActionOpen>(null);
const addAuthorRef = ref<CapitalActionOpen>(null);
const makeClearanceRef = ref<CapitalActionOpen>(null);

// Используем composable для загрузки проекта
const { project, projectHash, loadProject } = useProjectLoader();

// Хоткеи действуют на той вкладке, где видна соответствующая кнопка
useCapitalFabHotkeys(() => {
  const perms = project.value?.permissions;
  if (!perms) {
    return {};
  }

  if (!perms.has_clearance) {
    return !perms.pending_clearance
      ? { join: () => makeClearanceRef.value?.openDialog() }
      : {};
  }

  return {
    issue: perms.can_manage_issues
      ? () => createIssueRef.value?.openDialog()
      : undefined,
    requirement: perms.can_create_requirement
      ? () => createRequirementRef.value?.openDialog()
      : undefined,
    plan: perms.can_set_plan
      ? () => setPlanRef.value?.openDialog()
      : undefined,
    author: perms.can_manage_authors
      ? () => addAuthorRef.value?.openDialog()
      : undefined,
  };
});
const route = useRoute();
const router = useRouter();

// На странице задачи субменю компонента не показываем
const isIssueRoute = computed(() => {
  const name = String(route.name ?? '')
  return name === 'component-issue' || name.startsWith('component-issue-')
})

// Активная вкладка: вложенные маршруты подсвечивают родительскую вкладку
const activeTabKey = computed(() => {
  const name = String(route.name ?? '');
  if (name === 'component-requirement-detail') return 'component-requirements';
  return name;
});

// Управление (статус, мастер, video, git, удалить) — только на вкладке «Описание»
const showSidebar = computed(
  () => !isIssueRoute.value && activeTabKey.value === 'component-description',
);

// Субменю компонента (вкладки)
const componentTabs = computed(() => {
  const params = { project_hash: projectHash.value };
  const currentBackRoute = route.query._backRoute as string;
  const query = currentBackRoute ? { _backRoute: currentBackRoute } : {};

  return [
    { key: 'component-description', label: 'Описание', route: { name: 'component-description', params, query } },
    { key: 'component-tasks', label: 'Задачи', route: { name: 'component-tasks', params, query } },
    { key: 'component-requirements', label: 'Артефакты', route: { name: 'component-requirements', params, query } },
    { key: 'component-planning', label: 'План', route: { name: 'component-planning', params, query } },
    { key: 'component-voting', label: 'Голосование', route: { name: 'component-voting', params, query } },
    { key: 'component-results', label: 'Результаты', route: { name: 'component-results', params, query } },
    { key: 'component-contributors', label: 'Участники', route: { name: 'component-contributors', params, query } },
    { key: 'component-history', label: 'История', route: { name: 'component-history', params, query } },
  ];
});

// Настраиваем кнопку "Назад"
const { setBackButton } = useBackButton({
  text: 'Назад',
  componentId: 'component-base-' + projectHash.value,
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

// Отслеживаем изменение backRoute для обновления кнопки "Назад"
watch(() => route.query._backRoute, () => {
  setBackButton();
});

// Обработчик создания задачи
const handleIssueCreated = () => {
  // Можно добавить логику обновления списка задач
};

// Обработчик создания артефакта
const handleRequirementCreated = () => {
  // Можно добавить логику обновления списка артефактов
};

// Обработчик установки плана
const handlePlanSet = () => {
  // Можно добавить логику обновления данных проекта
};

// Обработчик добавления соавторов
const handleAuthorsAdded = () => {
  // Можно добавить логику обновления данных проекта
};

// Обработчик успешной отправки запроса на допуск
const handleClearanceSubmitted = async () => {
  // Обновляем данные проекта, чтобы отразить изменения в разрешениях
  await loadProject();
};

// Обработчик изменения полей в sidebar
const handleFieldChange = () => {
  // Просто триггер реактивности
};

// Обработчик обновления названия компонента
const handleTitleUpdate = (value: string) => {
  if (project.value) {
    project.value.title = value;
  }
};

const handleProjectDeleted = () => {
  const coopname = route.params.coopname as string;
  const parentHash = project.value?.parent_hash;
  if (parentHash) {
    router.push({
      name: 'project-description',
      params: { coopname, project_hash: parentHash },
    });
    return;
  }
  router.push({ name: 'projects-list', params: { coopname } });
};

onMounted(async () => {
  // Загружаем сохраненную ширину sidebar
  loadSidebarWidth();

  // Загружаем компонент при монтировании
  await loadProject();
});
</script>

<style lang="scss" scoped>
// Каркас первичной загрузки: повторяет раскладку «сайдбар + контент»
.component-page-skeleton {
  display: flex;
  gap: var(--p-4);
  padding: var(--p-4);

  &__side {
    width: 300px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: var(--p-3);

    .skel {
      height: 40px;
    }
  }

  &__main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--p-3);

    .skel--title {
      width: 240px;
      max-width: 60%;
    }
  }

  @media (max-width: 640px) {
    flex-direction: column;

    &__side {
      width: 100%;
    }
  }
}
</style>
