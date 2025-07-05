import { ref, onBeforeUnmount, type Component } from 'vue';

export interface HeaderAction {
  id: string;
  component: Component;
  props?: Record<string, any>;
  order?: number;
}

const headerActions = ref<HeaderAction[]>([]);

export const useHeaderActions = () => {
  const registeredActions = ref<string[]>([]);

  const registerAction = (action: HeaderAction) => {
    // Проверяем, не зарегистрирован ли уже такой ID
    const existingIndex = headerActions.value.findIndex(
      (a) => a.id === action.id,
    );

    if (existingIndex > -1) {
      // Обновляем существующий
      headerActions.value[existingIndex] = action;
    } else {
      // Добавляем новый
      headerActions.value.push(action);
    }

    // Сортируем по порядку
    headerActions.value.sort((a, b) => (a.order || 0) - (b.order || 0));

    // Запоминаем что мы зарегистрировали
    if (!registeredActions.value.includes(action.id)) {
      registeredActions.value.push(action.id);
    }
  };

  const unregisterAction = (actionId: string) => {
    const index = headerActions.value.findIndex((a) => a.id === actionId);
    if (index > -1) {
      headerActions.value.splice(index, 1);
    }

    const registeredIndex = registeredActions.value.indexOf(actionId);
    if (registeredIndex > -1) {
      registeredActions.value.splice(registeredIndex, 1);
    }
  };

  const clearActions = () => {
    // Очищаем только те действия, которые зарегистрировал этот компонент
    registeredActions.value.forEach((actionId) => {
      unregisterAction(actionId);
    });
    registeredActions.value = [];
  };

  // Автоматически очищаем при размонтировании компонента
  onBeforeUnmount(() => {
    clearActions();
  });

  return {
    headerActions: headerActions.value,
    registerAction,
    unregisterAction,
    clearActions,
  };
};

// Отдельный composable для чтения состояния (для MainHeader)
export const useHeaderActionsReader = () => {
  return {
    headerActions,
  };
};
