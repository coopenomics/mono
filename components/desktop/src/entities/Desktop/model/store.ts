import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { RouteRecordRaw, type RouteMeta, type Router } from 'vue-router';
import type {
  IHealthResponse,
  IBackNavigationButton,
  IDesktopWithNavigation,
} from './types';
import { api } from '../api';
import { useCurrentUser } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';

interface WorkspaceMenuItem {
  workspaceName: string;
  title: string;
  icon: string;
  mainRoute: RouteRecordRaw | null;
  meta: RouteMeta;
}

const namespace = 'desktops';
const STORAGE_KEY_WORKSPACE = 'monocoop-active-workspace';

export const useDesktopStore = defineStore(namespace, () => {
  const currentDesktop = ref<IDesktopWithNavigation>();
  const health = ref<IHealthResponse>();
  const online = ref<boolean>();
  const isWorkspaceChanging = ref<boolean>(false);
  const leftDrawerOpen = ref<boolean>(true);

  async function loadDesktop(): Promise<void> {
    const newDesktop = await api.getDesktop();
    // Если уже есть расширения, мерджим маршруты
    if (currentDesktop.value && currentDesktop.value.workspaces) {
      newDesktop.workspaces.forEach((newWs) => {
        const oldWs = currentDesktop.value?.workspaces.find(
          (ws) => ws.name === newWs.name,
        );
        if (oldWs && (oldWs as any).routes) {
          (newWs as any).routes = (oldWs as any).routes;
        }
      });
    }
    // Добавляем поле backNavigationButton если оно отсутствует
    currentDesktop.value = {
      ...newDesktop,
      backNavigationButton: currentDesktop.value?.backNavigationButton || null,
    };
    // Сбрасываем состояние загрузки после загрузки рабочего стола
    isWorkspaceChanging.value = false;
  }

  async function healthCheck(): Promise<void> {
    try {
      health.value = await api.healthCheck();
      online.value = health.value.status !== 'maintenance';
      if (!online.value) setTimeout(healthCheck, 10000);
    } catch {
      online.value = false;
      setTimeout(healthCheck, 10000);
    }
  }

  function setRoutes(workspaceName: string, routes: RouteRecordRaw[]): void {
    if (!currentDesktop.value) return;
    const ws = currentDesktop.value.workspaces.find(
      (w) => w.name === workspaceName,
    );
    if (ws) {
      (ws as any).routes = routes;
    }
  }

  const workspaceMenus = computed<WorkspaceMenuItem[]>(() => {
    if (!currentDesktop.value) return [];
    return currentDesktop.value.workspaces.map((ws) => {
      const routes: RouteRecordRaw[] = (ws as any).routes || [];
      const meta: RouteMeta =
        routes.length > 0 && routes[0].meta
          ? (routes[0].meta as RouteMeta)
          : { title: ws.title, icon: '', roles: [] };
      return {
        workspaceName: ws.name,
        title: ws.title,
        icon: meta.icon,
        mainRoute: routes.length > 0 ? routes[0] : null,
        meta,
      };
    });
  });

  // Храним название активного workspace
  const activeWorkspaceName = ref<string | null>(null);

  function selectWorkspace(name: string) {
    isWorkspaceChanging.value = true;
    activeWorkspaceName.value = name;
    // Сохраняем выбранный рабочий стол в localStorage
    localStorage.setItem(STORAGE_KEY_WORKSPACE, name);
  }

  // Функция для определения и выбора дефолтного рабочего стола
  function selectDefaultWorkspace() {
    // Сбрасываем состояние загрузки на случай если оно было установлено
    isWorkspaceChanging.value = false;

    // Проверяем, был ли ранее сохранен рабочий стол
    const savedWorkspace = localStorage.getItem(STORAGE_KEY_WORKSPACE);

    if (
      savedWorkspace &&
      currentDesktop.value?.workspaces.some((ws) => ws.name === savedWorkspace)
    ) {
      // Устанавливаем рабочий стол без включения состояния загрузки (это инициализация)
      activeWorkspaceName.value = savedWorkspace;
      localStorage.setItem(STORAGE_KEY_WORKSPACE, savedWorkspace);
      return;
    }

    // Если нет сохраненного рабочего стола, определяем по правам пользователя
    const userStore = useCurrentUser();

    if (userStore.isMember || userStore.isChairman) {
      // Для членов совета или председателя устанавливаем soviet
      const hasSoviet = currentDesktop.value?.workspaces.some(
        (ws) => ws.name === 'soviet',
      );
      if (hasSoviet) {
        activeWorkspaceName.value = 'soviet';
        localStorage.setItem(STORAGE_KEY_WORKSPACE, 'soviet');
        return;
      }
    }

    // В остальных случаях устанавливаем participant
    activeWorkspaceName.value = 'participant';
    localStorage.setItem(STORAGE_KEY_WORKSPACE, 'participant');
  }

  const activeSecondLevelRoutes = computed((): RouteRecordRaw[] => {
    if (!activeWorkspaceName.value) return [];
    const ws = workspaceMenus.value.find(
      (menu) => menu.workspaceName === activeWorkspaceName.value,
    );
    return ws && ws.mainRoute && ws.mainRoute.children
      ? (ws.mainRoute.children as RouteRecordRaw[])
      : [];
  });

  function registerWorkspaceMenus(router: Router): void {
    const baseRoute = router.getRoutes().find((r) => r.name === 'base');
    if (baseRoute) {
      workspaceMenus.value.forEach((menu) => {
        if (menu.mainRoute) {
          router.addRoute('base', menu.mainRoute as RouteRecordRaw);
        }
      });
    }
  }

  // Новый метод: удаляет workspace (расширение) из currentDesktop.workspaces по имени
  function removeWorkspace(workspaceName: string): void {
    if (currentDesktop.value && currentDesktop.value.workspaces) {
      currentDesktop.value.workspaces = currentDesktop.value.workspaces.filter(
        (ws) => ws.name !== workspaceName,
      );
    }
  }

  // Методы для управления навигацией
  function setBackNavigationButton(button: IBackNavigationButton) {
    if (!currentDesktop.value) return;
    currentDesktop.value.backNavigationButton = button;
  }

  function removeBackNavigationButton(componentId: string) {
    if (!currentDesktop.value) return;
    if (
      currentDesktop.value.backNavigationButton?.componentId === componentId
    ) {
      currentDesktop.value.backNavigationButton = null;
    }
  }

  const backNavigationButton = computed(
    () => currentDesktop.value?.backNavigationButton,
  );

  // Функция для управления состоянием загрузки
  function setWorkspaceChanging(value: boolean) {
    isWorkspaceChanging.value = value;
  }

  // Методы для управления левым drawer
  function toggleLeftDrawer() {
    leftDrawerOpen.value = !leftDrawerOpen.value;
  }

  function setLeftDrawerOpen(value: boolean) {
    leftDrawerOpen.value = value;
  }

  function closeLeftDrawerOnMobile() {
    // Проверяем, является ли устройство мобильным
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      leftDrawerOpen.value = false;
    }
  }

  // Новый метод: получить данные маршрута по умолчанию без выполнения перехода
  function getDefaultPageRoute(): {
    name: string;
    params: Record<string, any>;
  } | null {
    const { info } = useSystemStore();

    if (!currentDesktop.value || !activeWorkspaceName.value) {
      return null;
    }

    // Найти текущий рабочий стол
    const currentWorkspace = currentDesktop.value.workspaces.find(
      (ws) => ws.name === activeWorkspaceName.value,
    );

    if (!currentWorkspace) {
      return null;
    }

    // Проверяем наличие defaultRoute
    if ((currentWorkspace as any).defaultRoute) {
      return {
        name: (currentWorkspace as any).defaultRoute,
        params: { coopname: info.coopname },
      };
    }

    // Если нет defaultRoute, ищем первый маршрут в детях основного маршрута
    const ws = workspaceMenus.value.find(
      (menu) => menu.workspaceName === activeWorkspaceName.value,
    );
    if (
      ws &&
      ws.mainRoute &&
      ws.mainRoute.children &&
      ws.mainRoute.children.length > 0
    ) {
      const firstChild = ws.mainRoute.children[0];
      return {
        name: firstChild.name as string,
        params: { coopname: info.coopname },
      };
    }

    return null;
  }

  // Новый метод: перейти на маршрут по умолчанию для текущего рабочего стола
  function goToDefaultPage(router: Router): void {
    // Используем новую функцию для получения данных маршрута
    const defaultPageRoute = getDefaultPageRoute();

    if (defaultPageRoute) {
      // Если маршрут найден, выполняем переход
      router.push(defaultPageRoute);
      // Устанавливаем небольшую задержку для плавного перехода
      setTimeout(() => {
        isWorkspaceChanging.value = false;
      }, 500);
    } else {
      // Если маршрут не найден, просто сбрасываем состояние загрузки
      isWorkspaceChanging.value = false;
    }
  }

  return {
    currentDesktop,
    health,
    online,
    isWorkspaceChanging,
    leftDrawerOpen,
    loadDesktop,
    healthCheck,
    setRoutes,
    workspaceMenus,
    activeWorkspaceName,
    selectWorkspace,
    selectDefaultWorkspace,
    activeSecondLevelRoutes,
    registerWorkspaceMenus,
    removeWorkspace,
    getDefaultPageRoute,
    goToDefaultPage,
    setWorkspaceChanging,
    toggleLeftDrawer,
    setLeftDrawerOpen,
    closeLeftDrawerOnMobile,
    // Новые методы
    setBackNavigationButton,
    removeBackNavigationButton,
    backNavigationButton,
  };
});
