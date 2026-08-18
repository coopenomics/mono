import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { RouteRecordRaw, type RouteMeta, type Router } from 'vue-router';
import type {
  IBackNavigationButton,
  IDesktopWithNavigation,
} from './types';
import { api } from '../api';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';

interface WorkspaceMenuItem {
  workspaceName: string;
  title: string;
  icon: string;
  extensionName: string;
  mainRoute: RouteRecordRaw | null;
  meta: RouteMeta;
}

const namespace = 'desktops';
const STORAGE_KEY_WORKSPACE = 'monocoop-active-workspace';

// Вспомогательные функции для безопасного доступа к localStorage (SSR-safe)
function safeLocalStorageGetItem(key: string): string | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn('Failed to read from localStorage:', error);
    return null;
  }
}

function safeLocalStorageSetItem(key: string, value: string): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn('Failed to write to localStorage:', error);
  }
}

export const useDesktopStore = defineStore(namespace, () => {
  const currentDesktop = ref<IDesktopWithNavigation>();
  const isWorkspaceChanging = ref<boolean>(false);
  const leftDrawerOpen = ref<boolean>(true);
  // Транзиентное переопределение заголовка шапки: detail-страница задаёт
  // динамическое имя (например название собрания), затем очищает при уходе.
  // Имеет приоритет над route.meta.title. Не персистентно.
  const pageTitleOverride = ref<string | null>(null);

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

    console.log('🏠 [DesktopStore] Desktop updated, active workspace:', activeWorkspaceName.value);
    // Сбрасываем состояние загрузки после загрузки рабочего стола
    isWorkspaceChanging.value = false;
  }


  function setRoutes(workspaceName: string, routes: RouteRecordRaw[]): void {
    if (!currentDesktop.value) {
      console.warn('🏠 [DesktopStore] Cannot set routes: no current desktop');
      return;
    }

    const ws = currentDesktop.value.workspaces.find(
      (w) => w.name === workspaceName,
    );

    if (ws) {
      (ws as any).routes = routes;
    } else {
      console.warn('🏠 [DesktopStore] Workspace not found for setting routes:', workspaceName);
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

      // Приоритет иконки: 1) из workspace (с бэкенда), 2) из meta маршрута
      const icon = (ws as any).icon || meta.icon || 'fa-solid fa-desktop';

      return {
        workspaceName: ws.name,
        title: ws.title,
        icon,
        extensionName: (ws as any).extension_name || 'unknown',
        mainRoute: routes.length > 0 ? routes[0] : null,
        meta,
      };
    });
  });

  // ─────────────────── Канон авторизации столов (grants) ───────────────────
  // Единый источник «кто что видит» — backend: getDesktop кладёт в каждый
  // workspace расширения массив `grants` (capability текущего пользователя).
  // Фронт лишь сверяет требование маршрута `meta.requires` с этим набором
  // (plain includes) — без собственной policy. Расширения без grants
  // (`grants === undefined`) работают по-старому: видимость по `meta.roles`.
  // Подробности и схема — components/context/notes/EXTENSIONS_SCHEMA_SYSTEM.md.

  function workspaceGrants(workspaceName: string): string[] | undefined {
    const ws = currentDesktop.value?.workspaces.find((w) => w.name === workspaceName);
    // Бэкенд отдаёт `grants: null` для core-столов (нет провайдера грантов) и
    // массив (возможно пустой `[]`) для grant-управляемых расширений. Схлопываем
    // null → undefined, чтобы core-столы шли по legacy-ветке `meta.roles`, а
    // осмысленный пустой набор `[]` (grant-режим без прав) сохранялся как есть.
    const grants = (ws as any)?.grants;
    return grants ?? undefined;
  }

  function currentUserRole(): string {
    const session = useSessionStore();
    return session.isChairman ? 'chairman' : session.isMember ? 'member' : 'user';
  }

  /**
   * Выдано ли пайщику конкретное право в столе расширения.
   *
   * В отличие от `isPageVisible` / `hasRouteAccess` (сверяют `meta.requires`
   * маршрута) — для фоновых запросов глобальных виджетов, не привязанных к
   * маршруту: оверлей висит поверх всего ЛК и обязан спрашивать бэкенд только
   * о том, на что у пайщика есть права, иначе резолвер отвечает 403 на каждой
   * дочитке (инцидент 2026-08-06: гейт «подпись на месте» раз в минуту просил
   * акты поставщика у пайщика без допуска в реестре).
   *
   * Стол ещё не загружен или не грант-управляемый → `false`: фоновому опросу
   * лучше промолчать и повториться на следующей дочитке, чем ловить 403.
   */
  function hasGrant(workspaceName: string, grant: string): boolean {
    return workspaceGrants(workspaceName)?.includes(grant) ?? false;
  }

  // Видна ли страница (пункт меню / доступ к маршруту) внутри стола.
  function isPageVisible(meta: RouteMeta | undefined, workspaceName: string): boolean {
    const grants = workspaceGrants(workspaceName);
    if (grants !== undefined) {
      // grant-стол: страница объявляет требование `requires` и видна, только
      // если право выдано бэкендом. Страница без `requires` в grant-столе
      // скрыта (иначе пустой набор грантов открыл бы её всем).
      const requires = (meta as any)?.requires as string | undefined;
      return requires ? grants.includes(requires) : false;
    }
    // legacy: по core-роли
    const roles = (meta as any)?.roles as string[] | undefined;
    return !roles || roles.length === 0 || roles.includes(currentUserRole());
  }

  // Виден ли стол в переключателе: для grant-стола — есть хотя бы одна
  // доступная по грантам страница; для legacy — по роли родительского маршрута.
  function isWorkspaceVisible(menuItem: WorkspaceMenuItem): boolean {
    const grants = workspaceGrants(menuItem.workspaceName);
    if (grants !== undefined) {
      const children = (menuItem.mainRoute?.children ?? []) as RouteRecordRaw[];
      return children.some((c) => {
        const requires = (c.meta as any)?.requires as string | undefined;
        return requires ? grants.includes(requires) : false;
      });
    }
    const roles = (menuItem.meta as any)?.roles as string[] | undefined;
    return !roles || roles.length === 0 || roles.includes(currentUserRole());
  }

  /**
   * Имя стола, которому принадлежит маршрут: среди `matched`-имён ищем то,
   * что объявлено столом на бэкенде (родительский маршрут стола назван так же,
   * как workspace). Общий хелпер для гарда — и проверки доступа, и поиска шлюза.
   */
  function workspaceNameFromRoute(
    matchedRouteNames: Array<string | symbol | null | undefined>,
  ): string | undefined {
    const wsNames = new Set(
      (currentDesktop.value?.workspaces ?? []).map((w) => w.name),
    );
    return matchedRouteNames
      .filter((n): n is string | symbol => n != null)
      .map(String)
      .find((n) => wsNames.has(n));
  }

  /**
   * Страница-шлюз стола, доступная пайщику сейчас (`meta.gate` + выданное
   * `requires`), либо `null`.
   *
   * Нужна навигационному гарду: пайщик без допуска в стол просит рабочую
   * страницу (из меню, по ссылке, из истории браузера) — вести его на глухое
   * «Недостаточно прав доступа» неверно, потому что допуск он получает сам,
   * на шлюзе. Инцидент 2026-08-11: заказчик подписал оферту ЦПП ещё при
   * регистрации, но пункт выдачи не выбирал, поэтому `Order:create` не выдан;
   * заход на каталог давал отказ вместо страницы подключения к Столу заказов.
   *
   * Ищем именно по `meta.gate`, а не «первую доступную страницу»: порядок
   * маршрутов в install.ts — деталь оформления, и рабочая страница, случайно
   * оказавшаяся первой, увела бы пайщика мимо шлюза.
   */
  function gateRouteFor(workspaceName: string): { name: string } | null {
    const ws = workspaceMenus.value.find((m) => m.workspaceName === workspaceName);
    const children = (ws?.mainRoute?.children ?? []) as RouteRecordRaw[];
    const gate = children.find(
      (c) =>
        (c.meta as RouteMeta | undefined)?.gate === true &&
        isPageVisible(c.meta as RouteMeta, workspaceName),
    );
    return gate?.name ? { name: String(gate.name) } : null;
  }

  // Доступ к маршруту для навигационного гарда. В grant-столе глушит только при
  // явном невыполненном `requires`; нет требования → пускаем (настоящий
  // enforcement — на резолверах бэкенда). Для legacy — по `meta.roles`.
  function hasRouteAccess(
    matchedRouteNames: Array<string | symbol | null | undefined>,
    meta: RouteMeta | undefined,
  ): boolean {
    const wsName = workspaceNameFromRoute(matchedRouteNames);
    const grants = wsName ? workspaceGrants(wsName) : undefined;
    if (grants !== undefined) {
      const requires = (meta as any)?.requires as string | undefined;
      if (!requires) return true;
      return grants.includes(requires);
    }
    const roles = (meta as any)?.roles as string[] | undefined;
    return !roles || roles.length === 0 || roles.includes(currentUserRole());
  }

  // Храним название активного workspace
  const activeWorkspaceName = ref<string | null>(null);

  function selectWorkspace(name: string) {
    isWorkspaceChanging.value = true;
    activeWorkspaceName.value = name;
    // Сохраняем выбранный рабочий стол в localStorage (SSR-safe)
    safeLocalStorageSetItem(STORAGE_KEY_WORKSPACE, name);
  }

  /**
   * Синхронизирует активный рабочий стол с ТЕКУЩИМ маршрутом.
   *
   * Находит workspace, которому принадлежит маршрут — по имени родительского
   * маршрута стола (`mainRoute.name`), присутствующему в цепочке `to.matched`, —
   * и делает его активным. БЕЗ навигации и БЕЗ спиннера (isWorkspaceChanging
   * не трогаем): мы уже находимся на этом маршруте, надо лишь поправить состояние.
   *
   * Зачем: `activeWorkspaceName` иначе ставится только кликом по плитке стола,
   * редиректом с `index` и из localStorage. При прямом заходе по URL или при
   * переходе кнопкой со стола А на маршрут стола Б активный стол оставался
   * прежним — в шапке и левом меню «висел» не тот стол. Маппинг идёт по
   * `mainRoute.name → workspaceName`, поэтому не зависит от совпадения имени
   * workspace с именем маршрута. Если маршрут не принадлежит ни одному столу
   * (глобальные /auth/*, и т.п.) — ничего не меняем.
   *
   * @returns true, если активный стол был определён по маршруту.
   */
  function syncActiveWorkspaceFromRoute(
    matchedRouteNames: Array<string | symbol | null | undefined>,
  ): boolean {
    if (!currentDesktop.value) return false;
    const names = new Set(
      matchedRouteNames.filter((n): n is string | symbol => n != null).map(String),
    );
    const owner = workspaceMenus.value.find(
      (menu) => menu.mainRoute?.name != null && names.has(String(menu.mainRoute.name)),
    );
    if (!owner) return false;
    if (activeWorkspaceName.value !== owner.workspaceName) {
      activeWorkspaceName.value = owner.workspaceName;
      safeLocalStorageSetItem(STORAGE_KEY_WORKSPACE, owner.workspaceName);
    }
    return true;
  }

  // Функция для определения и выбора дефолтного рабочего стола
  function selectDefaultWorkspace(ignoreSaved = false) {
    // Сбрасываем состояние загрузки на случай если оно было установлено
    isWorkspaceChanging.value = false;

    // Проверяем, был ли ранее сохранен рабочий стол (SSR-safe)
    // Но игнорируем сохраненный выбор если передан флаг ignoreSaved (например, после логина)
    if (!ignoreSaved) {
      const savedWorkspace = safeLocalStorageGetItem(STORAGE_KEY_WORKSPACE);

      if (
        savedWorkspace &&
        currentDesktop.value?.workspaces.some((ws) => ws.name === savedWorkspace)
      ) {
        // Устанавливаем сохраненный рабочий стол без включения состояния загрузки (это инициализация)
        activeWorkspaceName.value = savedWorkspace;
        return;
      }
    }

    // Получаем настройки системы
    const systemStore = useSystemStore();
    const session = useSessionStore();

    let defaultWorkspace = 'participant'; // дефолтное значение

    // При первом входе председателя без сохранённого выбора отправляем на стол председателя
    if (session.isChairman) {
      const hasChairmanWorkspace = currentDesktop.value?.workspaces.some((ws) => ws.name === 'chairman');
      if (hasChairmanWorkspace) {
        activeWorkspaceName.value = 'chairman';
        safeLocalStorageSetItem(STORAGE_KEY_WORKSPACE, 'chairman');
        return;
      }
    }

    // Authorized-рабочий стол выбираем только если пайщик принят советом
    // (status='active'). На промежуточных статусах юзер с WIF, но без участия —
    // должен видеть публичную главную, не дашборд (см. SessionStore.isFullyActive).
    if (session.isFullyActive) {
      defaultWorkspace = systemStore.info?.settings?.authorized_default_workspace || 'participant';
    } else {
      defaultWorkspace = systemStore.info?.settings?.non_authorized_default_workspace || 'participant';
    }

    // Проверяем, что выбранный рабочий стол доступен
    const isWorkspaceAvailable = currentDesktop.value?.workspaces.some((ws) => ws.name === defaultWorkspace);

    if (isWorkspaceAvailable) {
      activeWorkspaceName.value = defaultWorkspace;
      safeLocalStorageSetItem(STORAGE_KEY_WORKSPACE, defaultWorkspace);
    } else {
      // Если настроенный рабочий стол недоступен, используем participant
      activeWorkspaceName.value = 'participant';
      safeLocalStorageSetItem(STORAGE_KEY_WORKSPACE, 'participant');
    }
  }

  const activeSecondLevelRoutes = computed((): RouteRecordRaw[] => {
    if (!activeWorkspaceName.value) {
      return [];
    }

    const ws = workspaceMenus.value.find(
      (menu) => menu.workspaceName === activeWorkspaceName.value,
    );

    const routes = ws && ws.mainRoute && ws.mainRoute.children
      ? (ws.mainRoute.children as RouteRecordRaw[])
      : [];

    return routes;
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

  // Переопределение заголовка шапки (см. pageTitleOverride выше).
  function setPageTitleOverride(title: string) {
    pageTitleOverride.value = title;
  }
  function clearPageTitleOverride() {
    pageTitleOverride.value = null;
  }

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
    const session = useSessionStore();

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

    // Проверяем, есть ли настроенный маршрут для текущего рабочего стола
    let configuredRoute: string | undefined;

    // Authorized-маршрут — только для принятых советом (см. isFullyActive).
    // На created/joined/payed/registered отдаём non_authorized_default_route.
    if (session.isFullyActive) {
      configuredRoute = info?.settings?.authorized_default_route;
    } else {
      configuredRoute = info?.settings?.non_authorized_default_route;
    }

    // Если настроенный маршрут существует, используем его
    if (configuredRoute) {
      // Глобальные маршруты (не принадлежащие конкретному workspace)
      const globalRoutes = ['signin', 'signup', 'lostkey', 'resetkey', 'recover', 'recoverConfirm', 'invite'];
      if (globalRoutes.includes(configuredRoute)) {
        return {
          name: configuredRoute,
          params: { coopname: info.coopname },
        };
      }

      // Проверяем, что маршрут принадлежит текущему рабочему столу
      const ws = workspaceMenus.value.find(
        (menu) => menu.workspaceName === activeWorkspaceName.value,
      );
      if (
        ws &&
        ws.mainRoute &&
        ws.mainRoute.children &&
        ws.mainRoute.children.some((child: any) => child.name === configuredRoute)
      ) {
        return {
          name: configuredRoute,
          params: { coopname: info.coopname },
        };
      }
    }

    const ws = workspaceMenus.value.find(
      (menu) => menu.workspaceName === activeWorkspaceName.value,
    );
    const children = (ws?.mainRoute?.children ?? []) as RouteRecordRaw[];

    // defaultRoute рабочего стола — но только если он доступен текущему
    // пользователю по канону grants (иначе попали бы на permissionDenied,
    // напр. председатель до принятия ЦПП и admin-defaultRoute «Модерация»).
    const defaultRouteName = (currentWorkspace as any).defaultRoute as string | undefined;
    if (defaultRouteName) {
      const defaultChild = children.find((c) => c.name === defaultRouteName);
      if (
        defaultChild &&
        isPageVisible(defaultChild.meta as RouteMeta, activeWorkspaceName.value)
      ) {
        return { name: defaultRouteName, params: { coopname: info.coopname } };
      }
    }

    // Дефолт закрыт — значит допуска в стол нет. Сначала пробуем шлюз стола
    // (`meta.gate`): именно на нём допуск и получают. Только потом — первая
    // доступная страница, порядок которой в install.ts случаен.
    const gate = gateRouteFor(activeWorkspaceName.value as string);
    if (gate) {
      return { name: gate.name, params: { coopname: info.coopname } };
    }

    const firstVisible = children.find((c) =>
      isPageVisible(c.meta as RouteMeta, activeWorkspaceName.value as string),
    );
    if (firstVisible?.name) {
      return { name: firstVisible.name as string, params: { coopname: info.coopname } };
    }

    return null;
  }

  /**
   * Первый доступный пайщику маршрут расширения (по канону grants): идём по
   * видимым столам расширения и берём первую видимую страницу. Используется
   * для редиректа после установки/включения — чтобы привести на то, что
   * пользователю реально доступно (напр. страница подключения ЦПП до онбординга,
   * а не дефолтный admin-роут, который ещё закрыт).
   */
  function firstAccessibleRoute(extensionName: string): { name: string } | null {
    const desks = workspaceMenus.value.filter(
      (m) => m.extensionName === extensionName && isWorkspaceVisible(m),
    );
    for (const desk of desks) {
      const children = (desk.mainRoute?.children ?? []) as RouteRecordRaw[];
      const visible = children.find((c) =>
        isPageVisible(c.meta as RouteMeta, desk.workspaceName),
      );
      if (visible?.name) return { name: String(visible.name) };
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
    isWorkspaceChanging,
    leftDrawerOpen,
    loadDesktop,
    setRoutes,
    workspaceMenus,
    // Канон авторизации столов (grants)
    hasGrant,
    isPageVisible,
    isWorkspaceVisible,
    hasRouteAccess,
    workspaceNameFromRoute,
    gateRouteFor,
    firstAccessibleRoute,
    activeWorkspaceName,
    selectWorkspace,
    syncActiveWorkspaceFromRoute,
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
    pageTitleOverride,
    setPageTitleOverride,
    clearPageTitleOverride,
  };
});
