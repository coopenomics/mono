<template lang="pug">
div.column.flex-1.min-h-0.min-w-0.no-wrap
  // Мобильный layout - колонки одна под другой
  div(v-if="isMobileLayout").column.col.flex-1.min-h-0.min-w-0
    div.q-px-md.q-pt-md(v-if="project")
      ProjectTitleEditor(
        :project="project"
        @field-change="handleFieldChange"
        @update:title="handleTitleUpdate"
      ).full-width
        template(#prepend-icon)
          q-icon(name='work', size='24px', color='primary')
    div
      ProjectSidebarWidget(
        :project="project"
        compact-mobile
        @project-deleted="handleProjectDeleted"
      )

    div.col.flex-1.min-h-0.min-w-0.column.overflow-hidden.relative-position
      div.col.min-h-0.overflow-auto.q-pt-md.min-w-0
        router-view

      Fab(v-if="project")
        // Если доступно больше одного действия - показываем раскрывающийся список
        template(#actions v-if="project?.permissions?.has_clearance && availableActions.length > 1")
          CreateComponentFabAction(
            ref="createComponentFabRef"
            v-if="project?.permissions?.can_edit_project"
            :project="project"
            @action-completed="handleComponentCreated"
          )
          CreateRequirementFabAction(
            ref="createRequirementFabRef"
            :filter="{ project_hash: projectHash }"
            :permissions="project?.permissions"
            @action-completed="handleRequirementCreated"
          )
          AddAuthorFabAction(
            ref="addAuthorFabRef"
            v-if="project?.permissions?.can_manage_authors"
            :project="project"
            @action-completed="handleAuthorsAdded"
          )
          ProjectInvestFabAction(
            ref="projectInvestFabRef"
            :project="project"
            @action-completed="handleInvestCompleted"
          )

        // Если доступно только одно действие - показываем его как основную кнопку
        template(#default)
          ProjectInvestFabAction(
            ref="projectInvestFabRef"
            v-if="project?.permissions?.has_clearance && availableActions.length === 1 && availableActions.includes('invest')"
            :project="project"
            fab
            @action-completed="handleInvestCompleted"
          )

          // Показываем кнопку ожидания, если запрос на допуск в рассмотрении
          PendingClearanceButton(
            v-else-if="project?.permissions?.pending_clearance"
          )

          // Показываем кнопку участия, если пользователь не имеет допуска к проекту
          MakeClearanceButton(
            ref="makeClearanceFabRef"
            v-else-if="!project?.permissions?.has_clearance"
            :project="project"
            fab
            @clearance-submitted="handleClearanceSubmitted"
          )

  // Десктоп: панель after без overflow-hidden — у q-splitter снова overflow:auto, иначе скролл «глушится»
  .column.flex-1.min-h-0.min-w-0.no-wrap(v-else)
    .q-px-md.q-pt-md(v-if="project")
      ProjectTitleEditor(
        :project="project"
        @field-change="handleFieldChange"
        @update:title="handleTitleUpdate"
      ).full-width
        template(#prepend-icon)
          q-icon(name='work', size='24px', color='primary')
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
        ProjectSidebarWidget(
          :project="project"
          @project-deleted="handleProjectDeleted"
        )

      template(#after)
        div.column.full-height.min-h-0.relative-position
          div.col.min-h-0.overflow-auto.q-pt-md.min-w-0
            router-view

          Fab(v-if="project")
            template(#actions v-if="project?.permissions?.has_clearance && availableActions.length > 1")
              CreateComponentFabAction(
                ref="createComponentFabRef"
                v-if="project?.permissions?.can_edit_project"
                :project="project"
                @action-completed="handleComponentCreated"
              )
              CreateRequirementFabAction(
                ref="createRequirementFabRef"
                :filter="{ project_hash: projectHash }"
                :permissions="project?.permissions"
                @action-completed="handleRequirementCreated"
              )
              AddAuthorFabAction(
                ref="addAuthorFabRef"
                v-if="project?.permissions?.can_manage_authors"
                :project="project"
                @action-completed="handleAuthorsAdded"
              )
              ProjectInvestFabAction(
                ref="projectInvestFabRef"
                :project="project"
                @action-completed="handleInvestCompleted"
              )

            template(#default)
              ProjectInvestFabAction(
                ref="projectInvestFabRef"
                v-if="project?.permissions?.has_clearance && availableActions.length === 1 && availableActions.includes('invest')"
                :project="project"
                fab
                @action-completed="handleInvestCompleted"
              )

              PendingClearanceButton(
                v-else-if="project?.permissions?.pending_clearance"
              )

              MakeClearanceButton(
                ref="makeClearanceFabRef"
                v-else-if="!project?.permissions?.has_clearance"
                :project="project"
                fab
                @clearance-submitted="handleClearanceSubmitted"
              )
</template>
<script lang="ts" setup>
import { onMounted, onBeforeUnmount, computed, markRaw, watch, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useWindowSize } from 'src/shared/hooks/useWindowSize';
import { useProjectLoader } from 'app/extensions/capital/entities/Project/model';
import { useBackButton } from 'src/shared/lib/navigation';
import { useHeaderActions } from 'src/shared/hooks';
import { RouteMenuButton, Fab } from 'src/shared/ui';
import { CreateComponentFabAction } from 'app/extensions/capital/features/Project/CreateComponent';
import { CreateRequirementFabAction } from 'app/extensions/capital/features/Story/CreateStory';
// import { SetPlanFabAction } from 'app/extensions/capital/features/Project/SetPlan';
import { ProjectInvestFabAction } from 'app/extensions/capital/features/Invest/CreateProjectInvest';
import { AddAuthorFabAction } from 'app/extensions/capital/features/Project/AddAuthor';
import { MakeClearanceButton } from 'app/extensions/capital/features/Contributor/MakeClearance';
import { PendingClearanceButton } from 'app/extensions/capital/shared/ui/PendingClearanceButton';
import { ProjectSidebarWidget } from 'app/extensions/capital/widgets';
import { ProjectTitleEditor } from 'app/extensions/capital/widgets/ProjectTitleEditor';
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

// Список доступных действий для FAB
const availableActions = computed(() => {
  if (!project.value?.permissions?.has_clearance) return [];

  const actions: any = [];
  const p = project.value.permissions;

  if (p.can_edit_project) actions.push('component');
  if (p.can_create_requirement) actions.push('requirement');
  if (p.can_manage_authors) actions.push('author');
  // Инвестирование доступно всем участникам с допуском
  actions.push('invest');

  return actions;
});

type CapitalFabOpen = { openDialog: () => void } | null;

const createComponentFabRef = ref<CapitalFabOpen>(null);
const createRequirementFabRef = ref<CapitalFabOpen>(null);
const addAuthorFabRef = ref<CapitalFabOpen>(null);
const projectInvestFabRef = ref<CapitalFabOpen>(null);
const makeClearanceFabRef = ref<CapitalFabOpen>(null);

// Используем composable для загрузки проекта
const { project, projectHash, loadProject } = useProjectLoader();

useCapitalFabHotkeys(() => {
  const perms = project.value?.permissions;
  if (!perms) {
    return {};
  }

  const joinHandler =
    !perms.has_clearance && !perms.pending_clearance
      ? () => makeClearanceFabRef.value?.openDialog()
      : undefined;

  if (!perms.has_clearance) {
    return joinHandler ? { join: joinHandler } : {};
  }

  return {
    component: perms.can_edit_project
      ? () => createComponentFabRef.value?.openDialog()
      : undefined,
    requirement: perms.can_create_requirement
      ? () => createRequirementFabRef.value?.openDialog()
      : undefined,
    author: perms.can_manage_authors
      ? () => addAuthorFabRef.value?.openDialog()
      : undefined,
    invest: () => projectInvestFabRef.value?.openDialog(),
  };
});
const route = useRoute();
const router = useRouter();

// Массив кнопок меню для шапки
const menuButtons = computed(() => {
  const currentBackRoute = route.query._backRoute as string;
  const query = currentBackRoute ? { _backRoute: currentBackRoute } : {};

  return [
    {
      id: 'project-description-menu',
      component: markRaw(RouteMenuButton),
      props: {
        routeName: 'project-description',
        label: 'Описание',
        icon: 'description',
        routeParams: { project_hash: projectHash.value },
        query,
      },
      order: 1,
    },
    {
      id: 'project-requirements-menu',
      component: markRaw(RouteMenuButton),
      props: {
        routeName: 'project-requirements',
        label: 'Артефакты',
        icon: 'inventory_2',
        routeParams: { project_hash: projectHash.value },
        query,
      },
      order: 2,
    },
    {
      id: 'project-components-menu',
      component: markRaw(RouteMenuButton),
      props: {
        routeName: 'project-components',
        label: 'Компоненты',
        icon: 'widgets',
        routeParams: { project_hash: projectHash.value },
        query,
      },
      order: 3,
    },
    {
      id: 'project-planning-menu',
      component: markRaw(RouteMenuButton),
      props: {
        routeName: 'project-planning',
        label: 'План',
        icon: 'timeline',
        routeParams: { project_hash: projectHash.value },
        query,
      },
      order: 4,
    },
    {
      id: 'project-contributors-menu',
      component: markRaw(RouteMenuButton),
      props: {
        routeName: 'project-contributors',
        label: 'Участники',
        icon: 'groups',
        routeParams: { project_hash: projectHash.value },
        query,
      },
      order: 6,
    },
    {
      id: 'project-history-menu',
      component: markRaw(RouteMenuButton),
      props: {
        routeName: 'project-history',
        label: 'История',
        icon: 'history',
        routeParams: { project_hash: projectHash.value },
        query,
      },
      order: 7,
    },
  ];
});

// Настраиваем кнопку "Назад"
const { setBackButton } = useBackButton({
  text: 'Назад',
  componentId: 'project-base-' + projectHash.value,
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
      router.push({ name: 'projects-list' });
    }
  }
});

// Регистрируем кнопки меню в header
const { registerAction: registerHeaderAction, clearActions } = useHeaderActions();


// Явно очищаем кнопки при уходе со страницы
onBeforeUnmount(() => {
  clearActions();
});

// Отслеживаем изменение backRoute для обновления кнопки "Назад"
watch(() => route.query._backRoute, () => {
  setBackButton();
});

// Отслеживаем переходы на дочерние маршруты (например, на страницу задачи)
watch(() => route.name, (newRouteName) => {
  if (newRouteName === 'project-issue') {
    // Если перешли на страницу задачи - очищаем кнопки меню проекта
    clearActions();
  } else if (newRouteName && newRouteName.toString().startsWith('project-') && newRouteName !== 'project-base') {
    // Если вернулись на страницы проекта - регистрируем кнопки снова
    menuButtons.value.forEach(button => {
      registerHeaderAction(button);
    });
  }
});


// Обработчик создания компонента
const handleComponentCreated = () => {
  // Можно добавить логику обновления списка компонентов
};

// Обработчик создания артефакта
const handleRequirementCreated = () => {
  // Можно добавить логику обновления списка артефактов
};

// Обработчик установки плана
// const handlePlanSet = () => {
  // Можно добавить логику обновления данных проекта
// };

// Обработчик добавления соавторов
const handleAuthorsAdded = () => {
  // Можно добавить логику обновления данных проекта
};

// Обработчик создания инвестиции
const handleInvestCompleted = () => {
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

// Обработчик обновления названия проекта в sidebar
const handleTitleUpdate = (value: string) => {
  if (project.value) {
    project.value.title = value;
  }
};

const handleProjectDeleted = () => {
  const coopname = route.params.coopname as string;
  router.push({ name: 'projects-list', params: { coopname } });
};

// Регистрируем действия в header
onMounted(async () => {
  // Загружаем сохраненную ширину sidebar
  loadSidebarWidth();

  // Загружаем проект при монтировании (composable сделает это автоматически)
  await loadProject();

  // Регистрируем кнопки меню только если мы НЕ на странице задачи
  if (route.name !== 'project-issue') {
    menuButtons.value.forEach(button => {
      registerHeaderAction(button);
    });
  }
});

// Явно очищаем кнопки при уходе со страницы
onBeforeUnmount(() => {
  clearActions();
});

// Отслеживаем изменение backRoute для обновления кнопки "Назад"
watch(() => route.query._backRoute, () => {
  setBackButton();
});

// Отслеживаем переходы на дочерние маршруты (например, на страницу задачи)
watch(() => route.name, (newRouteName) => {
  if (newRouteName === 'project-issue') {
    // Если перешли на страницу задачи - очищаем кнопки меню проекта
    clearActions();
  } else if (newRouteName && newRouteName.toString().startsWith('project-') && newRouteName !== 'project-base') {
    // Если вернулись на страницы проекта - регистрируем кнопки снова
    menuButtons.value.forEach(button => {
      registerHeaderAction(button);
    });
  }
});


</script>

<style lang="scss" scoped>
.q-chip {
  font-weight: 500;
}

.text-h6 {
  margin-bottom: 4px;
}
</style>
