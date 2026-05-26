import { defineStore } from 'pinia';
import { computed, ref, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useSessionStore } from 'src/entities/Session';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { useActionsStore } from 'src/shared/lib/stores/actions.store';
import type { PageItem, GroupedItem, FlatCmdkItem } from './types';

const namespace = 'cmdk-menu';

export const useCmdkMenuStore = defineStore(namespace, () => {
  // Composables
  const router = useRouter();
  const session = useSessionStore();
  const desktop = useDesktopStore();
  const { info } = useSystemStore();
  const actionsStore = useActionsStore();

  // State
  const showDialog = ref(false);
  const searchQuery = ref('');
  const selectedIndex = ref(0);
  const selectedPageIndex = ref(-1);
  const searchInput = ref<HTMLInputElement | null>(null);
  const contentRef = ref<HTMLElement | null>(null);

  // Функция для определения ОС и типа устройства
  const getOSInfo = () => {
    const userAgent = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    if (isMobile) {
      return { os: 'mobile', shortcut: null };
    }

    // Определение ОС для desktop
    if (userAgent.includes('Mac')) {
      return { os: 'mac', shortcut: '⌘ + K' };
    } else if (userAgent.includes('Windows')) {
      return { os: 'windows', shortcut: 'Ctrl + K' };
    } else {
      // Linux или другие Unix-like системы
      return { os: 'linux', shortcut: 'Ctrl + K' };
    }
  };

  // Вычисляемое свойство для подсказки горячих клавиш
  const shortcutHint = computed(() => getOSInfo().shortcut);

  // Функция для оценки условий
  const evaluateCondition = (condition: string, context: Record<string, any>): boolean => {
    try {
      const func = new Function(...Object.keys(context), `return ${condition};`);
      return func(...Object.values(context));
    } catch (error) {
      console.error('Error evaluating condition:', error);
      return false;
    }
  };

  // Получение горячих клавиш для страниц
  const getShortcut = (pageName: string): string | undefined => {
    const shortcuts: Record<string, string> = {
      // 'projects-list': '⌘P',
      // 'capital-wallet': '⌘W',
      // 'tracker': '⌘T',
      // 'voting': '⌘V',
      // 'results': '⌘R',
    };
    return shortcuts[pageName];
  };

// Вычисляем роль пользователя
const userRole = computed(() =>
  session.isChairman ? 'chairman' : session.isMember ? 'member' : 'user'
);

// Группировка воркспейсов с их страницами
const groupedItems = computed<GroupedItem[]>(() => {

  const result = desktop.workspaceMenus
    // Видимость столов/страниц — канон авторизации (grants) с fallback на
    // legacy roles, единая логика в DesktopStore (isWorkspaceVisible/isPageVisible).
    .filter((item) => desktop.isWorkspaceVisible(item))
    .map(workspace => ({
      workspaceName: workspace.workspaceName,
      title: workspace.title,
      icon: workspace.icon,
      isActive: desktop.activeWorkspaceName === workspace.workspaceName,
      pages: (workspace.mainRoute?.children || [])
        .filter((page: any) => {
          const accessMatch = desktop.isPageVisible(page.meta, workspace.workspaceName);
          const conditionMatch = page.meta?.conditions
              ? evaluateCondition(page.meta.conditions, {
                isCoop: session.privateAccount?.type === 'organization' &&
                       session.privateAccount?.organization_data?.type?.toUpperCase() === 'COOP',
                userRole: userRole.value,
                userAccount: session.privateAccount,
                coopname: info.coopname,
                isOnboardingHidden: localStorage.getItem('chairman-onboarding-hidden') === 'true',
              })
            : true;
          const hiddenMatch = page.meta?.hidden ? !page.meta.hidden : true;

          return accessMatch && conditionMatch && hiddenMatch;
        })
        .map((page: any) => ({
          name: page.name,
          meta: page.meta,
          shortcut: getShortcut(page.name),
        }))
    }    ));

  // Сортировка: активный рабочий стол всегда первым
  result.sort((a, b) => {
    if (a.isActive) return -1;
    if (b.isActive) return 1;
    return 0;
  });

  return result;
});

// Поиск и фильтрация
const filteredItems = computed(() => {
  if (!searchQuery.value) {
    return groupedItems.value;
  }

    const query = searchQuery.value.toLowerCase();

    return groupedItems.value
      .map(group => ({
        ...group,
        pages: group.pages.filter(page =>
          page.meta.title.toLowerCase().includes(query) ||
          page.name.toLowerCase().includes(query) ||
          group.title.toLowerCase().includes(query) ||
          group.workspaceName.toLowerCase().includes(query)
        )
      }))
      .filter(group => group.pages.length > 0 || group.title.toLowerCase().includes(query));
  });

// Плоский список для поиска (без иерархии)
const flatSearchResults = computed<FlatCmdkItem[]>(() => {
  // Без запроса - показываем иерархию (groupedItems)
  if (!searchQuery.value) {
    return [];
  }

  const query = searchQuery.value.toLowerCase();
  const results: FlatCmdkItem[] = [];

  // Проверяем, ищет ли пользователь рабочие столы явно
  // Показываем столы если:
  // 1. Запрос содержит "стол" или "workspace" - явно ищет рабочие столы
  // 2. ИЛИ название рабочего стола НАЧИНАЕТСЯ с запроса - ищет конкретный стол
  const isSearchingWorkspaces = query.includes('стол') || query.includes('workspace') ||
    groupedItems.value.some(group =>
      group.title.toLowerCase().startsWith(query) ||
      group.workspaceName.toLowerCase().startsWith(query)
    );

  for (const group of groupedItems.value) {
    // Фильтруем страницы по запросу (достаточно частичного совпадения)
    const matchingPages = group.pages.filter(page =>
      page.meta.title.toLowerCase().includes(query) ||
      page.name.toLowerCase().includes(query)
    );

    // Если ищем рабочие столы - добавляем группу
    if (isSearchingWorkspaces) {
      const workspaceMatches = group.title.toLowerCase().startsWith(query) ||
        group.workspaceName.toLowerCase().startsWith(query);

      if (workspaceMatches) {
        results.push({
          type: 'workspace',
          workspaceName: group.workspaceName,
          workspaceTitle: group.title,
          workspaceIcon: group.icon,
          isActiveWorkspace: group.isActive,
          title: group.title,
          icon: group.icon,
        });
      }
    }

    // Добавляем страницы
    for (const page of matchingPages) {
      results.push({
        type: 'page',
        workspaceName: group.workspaceName,
        workspaceTitle: group.title,
        workspaceIcon: group.icon,
        isActiveWorkspace: group.isActive,
        page,
      });
    }
  }

  return results;
});

// Режим отображения: иерархия или плоский список
const isSearchMode = computed(() => searchQuery.value.length > 0);

  // Методы
  const openDialog = async () => {
    showDialog.value = true;
    await nextTick();
    searchInput.value?.focus();
    searchQuery.value = '';
    selectedIndex.value = 0;
    selectedPageIndex.value = -1;
  };

  const closeDialog = () => {
    showDialog.value = false;
    searchQuery.value = '';
  };

const handleSearch = () => {
  selectedIndex.value = 0;
  selectedPageIndex.value = -1;
};

// Выбор текущего элемента (для обоих режимов)
const selectCurrentItem = () => {
  if (isSearchMode.value && flatSearchResults.value.length > 0) {
    // Плоский режим - выбираем текущий элемент из flatSearchResults
    const currentItem = flatSearchResults.value[selectedIndex.value];
    if (!currentItem) return;

    if (currentItem.type === 'workspace') {
      selectGroupByName(currentItem.workspaceName);
    } else if (currentItem.page) {
      selectPage(currentItem.workspaceName, currentItem.page);
    }
    return;
  }

  // Иерархический режим (без поиска)
  if (filteredItems.value.length === 0) return;

  const currentGroup = filteredItems.value[selectedIndex.value];
  if (!currentGroup) return;

  // Если выбрана страница (selectedPageIndex >= 0), переходим на неё
  if (selectedPageIndex.value >= 0 && selectedPageIndex.value < currentGroup.pages.length) {
    const selectedPage = currentGroup.pages[selectedPageIndex.value];
    selectPage(currentGroup.workspaceName, selectedPage);
  } else {
    // Если выбрана группа (selectedPageIndex === -1), переходим на группу
    selectGroup(selectedIndex.value);
  }
};

const selectFirstItem = () => {
  if (isSearchMode.value && flatSearchResults.value.length > 0) {
    // Плоский режим - выбираем первый элемент
    const firstItem = flatSearchResults.value[0];
    if (firstItem.type === 'workspace') {
      selectGroupByName(firstItem.workspaceName);
    } else if (firstItem.page) {
      selectPage(firstItem.workspaceName, firstItem.page);
    }
    return;
  }

  // Иерархический режим
  if (filteredItems.value.length > 0) {
    const firstGroup = filteredItems.value[0];
    if (firstGroup.pages.length > 0) {
      selectPage(firstGroup.workspaceName, firstGroup.pages[0]);
    } else {
      selectGroup(0);
    }
  }
};

const scrollToSelected = () => {
  if (!contentRef.value) return;

  const selectedElement = contentRef.value.querySelector('.selected');
  if (!selectedElement) return;

  // Используем requestAnimationFrame для надежного ожидания обновления DOM
  requestAnimationFrame(() => {
    const container = contentRef.value;
    if (!container) return;

    // Простая логика: всегда прокручиваем выбранный элемент в верхнюю часть видимой области
    selectedElement.scrollIntoView({
      behavior: 'smooth',
      block: 'start', // элемент будет по центру видимой области
      inline: 'nearest'
    });
  });
};

// Навигация в режиме поиска (плоский список)
const navigateDownSearch = async () => {
  const totalItems = flatSearchResults.value.length;
  if (totalItems === 0) return;

  if (selectedIndex.value < totalItems - 1) {
    selectedIndex.value++;
  } else {
    selectedIndex.value = 0;
  }

  await nextTick();
  scrollToSelected();
};

const navigateUpSearch = async () => {
  const totalItems = flatSearchResults.value.length;
  if (totalItems === 0) return;

  if (selectedIndex.value > 0) {
    selectedIndex.value--;
  } else {
    selectedIndex.value = totalItems - 1;
  }

  await nextTick();
  scrollToSelected();
};

const navigateDown = async () => {
  // Режим поиска - используем плоский список
  if (isSearchMode.value) {
    await navigateDownSearch();
    return;
  }

  // Иерархический режим (без поиска)
  const totalGroups = filteredItems.value.length;
  if (totalGroups === 0) return;

  const currentGroup = filteredItems.value[selectedIndex.value];
  const hasPages = currentGroup.pages.length > 0;

  if (hasPages && selectedPageIndex.value < currentGroup.pages.length - 1) {
    selectedPageIndex.value++;
  } else if (selectedIndex.value < totalGroups - 1) {
    selectedIndex.value++;
    selectedPageIndex.value = -1;
  } else {
    selectedIndex.value = 0;
    selectedPageIndex.value = -1;
  }

  // Ждем обновления DOM перед скроллом
  await nextTick();
  scrollToSelected();
};

const navigateUp = async () => {
  // Режим поиска - используем плоский список
  if (isSearchMode.value) {
    await navigateUpSearch();
    return;
  }

  // Иерархический режим (без поиска)
  const totalGroups = filteredItems.value.length;
  if (totalGroups === 0) return;

  if (selectedPageIndex.value > 0) {
    selectedPageIndex.value--;
  } else if (selectedIndex.value > 0) {
    selectedIndex.value--;
    const prevGroup = filteredItems.value[selectedIndex.value];
    selectedPageIndex.value = prevGroup.pages.length > 0 ? prevGroup.pages.length - 1 : -1;
  } else {
    selectedIndex.value = totalGroups - 1;
    const lastGroup = filteredItems.value[selectedIndex.value];
    selectedPageIndex.value = lastGroup.pages.length > 0 ? lastGroup.pages.length - 1 : -1;
  }

  // Ждем обновления DOM перед скроллом
  await nextTick();
  scrollToSelected();
};

const selectGroup = (groupIndex: number) => {
  const group = filteredItems.value[groupIndex];
  if (!group) return;

  closeDialog();

  desktop.selectWorkspace(group.workspaceName);
  setTimeout(() => {
    desktop.goToDefaultPage(router);
  }, 100);
};

// Выбор группы по имени (для плоского списка)
const selectGroupByName = (workspaceName: string) => {
  closeDialog();

  desktop.selectWorkspace(workspaceName);
  setTimeout(() => {
    desktop.goToDefaultPage(router);
  }, 100);
};

  const selectPage = (workspaceName: string, page: PageItem) => {
    closeDialog();

    // Проверяем, есть ли действие вместо маршрута
    if (page.meta?.action) {
      actionsStore.executeAction(page.meta.action);
      return;
    }

    // Если воркспейс не активен, переключаемся на него и ждем
    if (desktop.activeWorkspaceName !== workspaceName) {
      desktop.selectWorkspace(workspaceName);
      // Ждем переключения воркспейса, затем переходим на страницу
      setTimeout(() => {
        router.push({
          name: page.name,
          params: { coopname: info.coopname },
        });
        // Сбрасываем состояние загрузки после перехода
        setTimeout(() => {
          desktop.setWorkspaceChanging(false);
        }, 500);
      }, 150);
    } else {
      // Воркспейс уже активен, переходим сразу
      router.push({
        name: page.name,
        params: { coopname: info.coopname },
      });
      // Сбрасываем состояние загрузки после перехода
      setTimeout(() => {
        desktop.setWorkspaceChanging(false);
      }, 500);
    }
  };

  // Обработчик клавиш для диалога (навигация внутри панели)
  const handleDialogKeydown = (event: KeyboardEvent) => {
    // Предотвращаем обработку глобального обработчика для диалога
    event.stopPropagation();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        navigateDown();
        break;
      case 'ArrowUp':
        event.preventDefault();
        navigateUp();
        break;
      case 'Enter':
        event.preventDefault();
        selectCurrentItem();
        break;
      case 'Escape':
        event.preventDefault();
        closeDialog();
        break;
    }
  };

  // Глобальные горячие клавиши
  const handleGlobalKeydown = (event: KeyboardEvent) => {
    // Определяем правильную клавишу-модификатор для текущей ОС
    const isMac = navigator.userAgent.includes('Mac');
    const modifierPressed = isMac ? event.metaKey : event.ctrlKey;

    // Проверяем комбинацию Ctrl/Cmd + K
    if (modifierPressed && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      event.stopPropagation();

      if (showDialog.value) {
        closeDialog();
      } else {
        openDialog();
      }
      return;
    }

    // Escape для закрытия панели (только когда панель открыта)
    if (event.key === 'Escape' && showDialog.value) {
      event.preventDefault();
      closeDialog();
    }
  };

  // Инициализация глобальных обработчиков клавиш
  const initGlobalKeydown = () => {
    document.addEventListener('keydown', handleGlobalKeydown);
  };

  const destroyGlobalKeydown = () => {
    document.removeEventListener('keydown', handleGlobalKeydown);
  };

  const setSearchInput = (input: HTMLInputElement | null) => {
    searchInput.value = input as HTMLInputElement | null;
  };

  const setContentRef = (ref: HTMLElement | null) => {
    contentRef.value = ref;
  };

  return {
    // State
    showDialog,
    searchQuery,
    selectedIndex,
    selectedPageIndex,
    searchInput,
    contentRef,

    // Computed
    filteredItems,
    flatSearchResults,
    isSearchMode,
    shortcutHint,
    activeWorkspaceIcon: computed(() => {
      const activeWorkspace = desktop.workspaceMenus.find(
        ws => ws.workspaceName === desktop.activeWorkspaceName
      );
      return activeWorkspace?.icon || 'fa-solid fa-desktop';
    }),
    activeWorkspaceTitle: computed(() => {
      const activeWorkspace = desktop.workspaceMenus.find(
        ws => ws.workspaceName === desktop.activeWorkspaceName
      );
      return activeWorkspace?.title || 'Рабочий стол';
    }),

    // Methods
    openDialog,
    closeDialog,
    handleSearch,
    handleDialogKeydown,
    selectFirstItem,
    selectCurrentItem,
    navigateDown,
    navigateUp,
    selectGroup,
    selectGroupByName,
    selectPage,
    setSearchInput,
    setContentRef,
    initGlobalKeydown,
    destroyGlobalKeydown,
  };
});
