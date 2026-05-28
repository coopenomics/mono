<template lang="pug">
div
  // Карусель с кнопкой активного рабочего стола
  q-carousel.workspace-menu(
    v-model='slideIndex',
    animated,
    infinite,
    :arrows='menuWorkspaces.length > 1',
    swipeable,
    control-type='flat',
    control-color='grey',
    height='100px',
    transition-prev='flip-left',
    transition-next='flip-right'
  )
    q-carousel-slide.flex.flex-center(
      v-for='(item, index) in menuWorkspaces',
      :name='index',
      :key='item.workspaceName'
    )
      q-btn.cursor-pointer.btn-menu.full-width(
        stack,
        flat,
        v-ripple,
        @click='handleClick(item, index)',
        align='center'
      )
        q-icon.btn-icon.q-pt-sm(:name='item.icon')
        span.btn-font {{ item.title }}

  // Диалоговое окно с рабочими столами
  q-dialog(v-model='showDialog')
    ModalBase(:title='"Выберите рабочий стол"', style='min-width: 700px; max-width: 90vw')

      q-card-section
        // Строка поиска
        q-input.q-mb-md(
          v-model='searchQuery',
          dense,
          outlined,
          placeholder='Поиск рабочих столов...',
          clearable
        )
          template(v-slot:prepend)
            q-icon(name='search')

        // Контейнер с группированными рабочими столами в виде сетки
        .dialog-workspaces-container.q-pt-md
          .app-group(v-for='(app, index) in filteredGroupedWorkspaces', :key='app.extensionName', :class='`group-color-${index % 10}`')
            // Цветная полоска как в ColorCard
            //- .group-color-bar

            // Заголовок приложения
            //- .app-header.text-caption.text-grey-7.text-uppercase.text-weight-bold(
            //-   v-if='groupedWorkspaces.length > 1'
            //- ) {{ app.extensionTitle }}

            // Рабочие столы приложения
            .workspaces-list
              q-btn.dialog-workspace-btn(
                v-for='workspace in app.workspaces',
                :key='workspace.workspaceName',
                flat,
                stack,
                :class='{ "active": isActive(workspace.workspaceName), "favorite": isFavorite(workspace.workspaceName) }',
                @click='selectFromDialog(workspace)'
              )
                q-icon.dialog-workspace-icon(:name='workspace.icon')
                span.dialog-workspace-title {{ workspace.title }}
                // Иконка избранного (подготовка для будущей функциональности)
                q-icon.favorite-icon(
                  v-if='isFavorite(workspace.workspaceName)',
                  name='star',
                  size='xs',
                  color='amber'
                )
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useSessionStore } from 'src/entities/Session';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { ModalBase } from 'src/shared/ui/ModalBase';

// Интерфейсы для типизации
interface WorkspaceMenuItem {
  workspaceName: string;
  title: string;
  icon: string;
  extensionName: string;
  mainRoute: any;
  meta: any;
}

interface GroupedApp {
  extensionName: string;
  extensionTitle: string;
  workspaces: WorkspaceMenuItem[];
}

const router = useRouter();
const session = useSessionStore();
const desktop = useDesktopStore();

// Состояние карусели и диалога
const slideIndex = ref(0);
const showDialog = ref(false);

// Состояние для поиска и фильтров
const searchQuery = ref('');
const favoriteWorkspaces = ref<Set<string>>(new Set()); // Избранные рабочие столы (подготовка)

// Загрузка избранных из localStorage
const loadFavorites = () => {
  try {
    const saved = localStorage.getItem('monocoop-favorite-workspaces');
    if (saved) {
      favoriteWorkspaces.value = new Set(JSON.parse(saved));
    }
  } catch (e) {
    console.error('Ошибка загрузки избранных:', e);
  }
};

// Сохранение избранных в localStorage (для будущего использования)
// const saveFavorites = () => {
//   try {
//     localStorage.setItem(
//       'monocoop-favorite-workspaces',
//       JSON.stringify(Array.from(favoriteWorkspaces.value))
//     );
//   } catch (e) {
//     console.error('Ошибка сохранения избранных:', e);
//   }
// };

// Проверка, является ли рабочий стол избранным
const isFavorite = (workspaceName: string): boolean => {
  return favoriteWorkspaces.value.has(workspaceName);
};

// Проверка, является ли рабочий стол активным
const isActive = (workspaceName: string): boolean => {
  return desktop.activeWorkspaceName === workspaceName;
};

// workspaceMenus – список рабочих столов из store
const workspaceMenus = computed(() => desktop.workspaceMenus);

// Вычисляем роль пользователя
const userRole = computed(() =>
  session.isChairman ? 'chairman' : session.isMember ? 'member' : 'user'
);

// Фильтрация по ролям
const menuWorkspaces = computed(() => {
  return workspaceMenus.value
    .filter(
      (item) =>
        item.meta.roles?.includes(userRole.value) ||
        item.meta.roles === undefined ||
        item.meta.roles.length === 0
    )
    .map(item => ({
      ...item,
      extensionName: (item as any).extensionName || 'unknown'
    })) as WorkspaceMenuItem[];
});

// Группировка рабочих столов по приложениям
const groupedWorkspaces = computed<GroupedApp[]>(() => {
  const groups = new Map<string, GroupedApp>();

  menuWorkspaces.value.forEach((workspace) => {
    const extensionName = workspace.extensionName;
    const extensionTitle = workspace.title
    if (!groups.has(extensionName)) {
      groups.set(extensionName, {
        extensionName,
        extensionTitle: extensionTitle,
        workspaces: []
      });
    }

    const group = groups.get(extensionName);
    if (group) {
      group.workspaces.push(workspace);
    }
  });

  return Array.from(groups.values());
});

// Фильтрация по поисковому запросу
const filteredGroupedWorkspaces = computed<GroupedApp[]>(() => {
  if (!searchQuery.value) {
    return groupedWorkspaces.value;
  }

  const query = searchQuery.value.toLowerCase();
  return groupedWorkspaces.value
    .map(app => ({
      ...app,
      workspaces: app.workspaces.filter(ws =>
        ws.title.toLowerCase().includes(query) ||
        ws.workspaceName.toLowerCase().includes(query)
      )
    }))
    .filter(app => app.workspaces.length > 0);
});


// Обработка клика на кнопку карусели
const handleClick = (item: WorkspaceMenuItem, index: number) => {
  if (slideIndex.value === index) {
    // Если кликнули на ту же кнопку - открываем диалог
    showDialog.value = true;
  } else {
    // Если кликнули на другую кнопку - переключаем слайд
    slideIndex.value = index;
    desktop.selectWorkspace(item.workspaceName);
    setTimeout(() => {
      desktop.goToDefaultPage(router);
    }, 100);
  }
};

// Выбор рабочего стола из диалога
const selectFromDialog = (workspace: WorkspaceMenuItem) => {
  showDialog.value = false;
  searchQuery.value = ''; // Очищаем поиск при закрытии

  // Обновляем индекс карусели
  const workspaceIndex = menuWorkspaces.value.findIndex(
    (item) => item.workspaceName === workspace.workspaceName
  );
  if (workspaceIndex !== -1) {
    slideIndex.value = workspaceIndex;
  }

  desktop.selectWorkspace(workspace.workspaceName);
  setTimeout(() => {
    desktop.goToDefaultPage(router);
  }, 100);
};

// Инициализация
onMounted(async () => {
  // Загружаем избранные
  loadFavorites();

  // Находим индекс активного рабочего стола
  const activeWorkspaceName = desktop.activeWorkspaceName;
  if (activeWorkspaceName) {
    const activeIndex = menuWorkspaces.value.findIndex(
      (item) => item.workspaceName === activeWorkspaceName
    );
    if (activeIndex !== -1) {
      slideIndex.value = activeIndex;
    }
  }
});

// При изменении slideIndex обновляем активный рабочий стол
watch(slideIndex, (newIndex) => {
  const item = menuWorkspaces.value[newIndex];
  if (item && desktop.activeWorkspaceName !== item.workspaceName) {
    desktop.selectWorkspace(item.workspaceName);
    setTimeout(() => {
      desktop.goToDefaultPage(router);
    }, 100);
  }
});
</script>

<style lang="scss">
// Стили для кнопки карусели (исходные)
.btn-menu {
  height: 100px;
  width: 100px;
  border-radius: 0 !important;
}

.btn-icon {
  font-size: 20px !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  .btn-menu:hover & {
    transform: scale(1.1);
  }
}

.btn-font {
  font-size: 8px !important;
  text-transform: capitalize;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  .btn-menu:hover & {
    transform: scale(1.1);
  }
}

.workspace-menu .q-carousel__slide {
  padding: 0px !important;
}

// Стили для диалогового окна
.dialog-workspaces-container {
  max-height: 60vh;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-start;
}

.app-group {
  display: inline-flex;
  flex-direction: column;
  min-width: fit-content;
  margin-bottom: 16px;
  border-radius: 16px;
  padding: 16px 14px 12px 14px;
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);

  &:hover {
    transform: translateY(-2px);
  }
}

.app-header {
  font-weight: 700;
  letter-spacing: 0.8px;
  margin-bottom: 10px;
  font-size: 11px;
  line-height: 1.2;
  white-space: nowrap;
  color: #424242;
  padding-left: 2px;
}

.group-color-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  border-radius: 16px 0 0 16px;
  box-shadow: 2px 0 4px rgba(0, 0, 0, 0.08);
}

// Цветовые варианты для групп
.group-color-0 {
  background: rgba(76, 175, 80, 0.04);
  border: 1px solid rgba(76, 175, 80, 0.12);

  .group-color-bar {
    background: linear-gradient(180deg, #4caf50 0%, #66bb6a 100%);
  }

  &:hover {
    background: rgba(76, 175, 80, 0.08);
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.2),
                0 2px 4px rgba(76, 175, 80, 0.1);
  }
}

.group-color-1 {
  background: rgba(25, 118, 210, 0.04);
  border: 1px solid rgba(25, 118, 210, 0.12);

  .group-color-bar {
    background: linear-gradient(180deg, #1976d2 0%, #42a5f5 100%);
  }

  &:hover {
    background: rgba(25, 118, 210, 0.08);
    box-shadow: 0 4px 12px rgba(25, 118, 210, 0.2),
                0 2px 4px rgba(25, 118, 210, 0.1);
  }
}

.group-color-2 {
  background: rgba(255, 152, 0, 0.04);
  border: 1px solid rgba(255, 152, 0, 0.12);

  .group-color-bar {
    background: linear-gradient(180deg, #ff9800 0%, #ffa726 100%);
  }

  &:hover {
    background: rgba(255, 152, 0, 0.08);
    box-shadow: 0 4px 12px rgba(255, 152, 0, 0.2),
                0 2px 4px rgba(255, 152, 0, 0.1);
  }
}

.group-color-3 {
  background: rgba(156, 39, 176, 0.04);
  border: 1px solid rgba(156, 39, 176, 0.12);

  .group-color-bar {
    background: linear-gradient(180deg, #9c27b0 0%, #ab47bc 100%);
  }

  &:hover {
    background: rgba(156, 39, 176, 0.08);
    box-shadow: 0 4px 12px rgba(156, 39, 176, 0.2),
                0 2px 4px rgba(156, 39, 176, 0.1);
  }
}

.group-color-4 {
  background: rgba(0, 150, 136, 0.04);
  border: 1px solid rgba(0, 150, 136, 0.12);

  .group-color-bar {
    background: linear-gradient(180deg, #009688 0%, #26a69a 100%);
  }

  &:hover {
    background: rgba(0, 150, 136, 0.08);
    box-shadow: 0 4px 12px rgba(0, 150, 136, 0.2),
                0 2px 4px rgba(0, 150, 136, 0.1);
  }
}

.group-color-5 {
  background: rgba(233, 30, 99, 0.04);
  border: 1px solid rgba(233, 30, 99, 0.12);

  .group-color-bar {
    background: linear-gradient(180deg, #e91e63 0%, #ec407a 100%);
  }

  &:hover {
    background: rgba(233, 30, 99, 0.08);
    box-shadow: 0 4px 12px rgba(233, 30, 99, 0.2),
                0 2px 4px rgba(233, 30, 99, 0.1);
  }
}

.group-color-6 {
  background: rgba(63, 81, 181, 0.04);
  border: 1px solid rgba(63, 81, 181, 0.12);

  .group-color-bar {
    background: linear-gradient(180deg, #3f51b5 0%, #5c6bc0 100%);
  }

  &:hover {
    background: rgba(63, 81, 181, 0.08);
    box-shadow: 0 4px 12px rgba(63, 81, 181, 0.2),
                0 2px 4px rgba(63, 81, 181, 0.1);
  }
}

.group-color-7 {
  background: rgba(0, 188, 212, 0.04);
  border: 1px solid rgba(0, 188, 212, 0.12);

  .group-color-bar {
    background: linear-gradient(180deg, #00bcd4 0%, #26c6da 100%);
  }

  &:hover {
    background: rgba(0, 188, 212, 0.08);
    box-shadow: 0 4px 12px rgba(0, 188, 212, 0.2),
                0 2px 4px rgba(0, 188, 212, 0.1);
  }
}

.group-color-8 {
  background: rgba(244, 67, 54, 0.04);
  border: 1px solid rgba(244, 67, 54, 0.12);

  .group-color-bar {
    background: linear-gradient(180deg, #f44336 0%, #ef5350 100%);
  }

  &:hover {
    background: rgba(244, 67, 54, 0.08);
    box-shadow: 0 4px 12px rgba(244, 67, 54, 0.2),
                0 2px 4px rgba(244, 67, 54, 0.1);
  }
}

.group-color-9 {
  background: rgba(158, 158, 158, 0.04);
  border: 1px solid rgba(158, 158, 158, 0.12);

  .group-color-bar {
    background: linear-gradient(180deg, #9e9e9e 0%, #bdbdbd 100%);
  }

  &:hover {
    background: rgba(158, 158, 158, 0.08);
    box-shadow: 0 4px 12px rgba(158, 158, 158, 0.2),
                0 2px 4px rgba(158, 158, 158, 0.1);
  }
}

.workspaces-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.dialog-workspace-btn {
  height: 100px;
  min-width: 100px;
  max-width: 120px;
  padding: 12px;
  border-radius: 16px !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  background-color: rgba(0, 105, 92, 0.04);
  border: 1px solid rgba(0, 105, 92, 0.08);

  &:hover {
    background-color: rgba(0, 105, 92, 0.08);
    transform: translateY(-4px) scale(1.02);
    box-shadow: 0 8px 16px rgba(0, 105, 92, 0.15),
                0 2px 4px rgba(0, 105, 92, 0.1);
  }

  &.active {
    background: linear-gradient(135deg, #00695c 0%, #00897b 100%) !important;
    color: white !important;
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 4px 12px rgba(0, 105, 92, 0.3),
                0 2px 4px rgba(0, 105, 92, 0.2);

    .dialog-workspace-icon,
    .dialog-workspace-title {
      color: white !important;
    }

    &:hover {
      transform: translateY(-4px) scale(1.02);
      box-shadow: 0 10px 20px rgba(0, 105, 92, 0.35),
                  0 4px 8px rgba(0, 105, 92, 0.25);
    }
  }

  &.favorite {
    border: 2px solid #ffc107;
    box-shadow: 0 2px 8px rgba(255, 193, 7, 0.2);
  }
}

.dialog-workspace-icon {
  font-size: 36px !important;
  margin-bottom: 10px;
  color: #00695c;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  .dialog-workspace-btn:hover & {
    transform: scale(1.1);
  }
}

.dialog-workspace-title {
  font-size: 11px !important;
  line-height: 1.3;
  text-align: center;
  text-transform: capitalize;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
  font-weight: 500;
  transition: all 0.3s ease;
}

.favorite-icon {
  position: absolute;
  top: 6px;
  right: 6px;
  filter: drop-shadow(0 1px 2px rgba(255, 193, 7, 0.3));
}

// Скроллбар для диалога
.dialog-workspaces-container::-webkit-scrollbar {
  width: 8px;
}

.dialog-workspaces-container::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.04);
  border-radius: 4px;
}

.dialog-workspaces-container::-webkit-scrollbar-thumb {
  background: rgba(0, 105, 92, 0.2);
  border-radius: 4px;
  transition: background 0.2s ease;
}

.dialog-workspaces-container::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 105, 92, 0.35);
}

</style>
