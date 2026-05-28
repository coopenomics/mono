<template lang="pug">
div
  transition(
    mode='out-in',
    enter-active-class='menu-enter-active',
    leave-active-class='menu-leave-active'
  )
    q-list.second-menu(v-if='filteredRoutes.length > 0', :key='menuKey')
      q-item.menu-item(
        v-for='(route, index) in filteredRoutes',
        :key='route.name',
        clickable,
        v-ripple,
        :active='isActive(route)',
        active-class='bg-gradient-dark text-white',
        @click='navigate(route)',
        :style='{ "animation-delay": `${index * 60}ms` }'
      )
        q-item-section
          q-item-label.no-select
            span {{ route.meta.title }}
</template>

<script lang="ts" setup>
import { useSessionStore } from 'src/entities/Session';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { useActionsStore } from 'src/shared/lib/stores/actions.store';
import type { IRoute } from 'src/entities/Desktop/model/types';
import { Zeus } from '@coopenomics/sdk';

const desktop = useDesktopStore();
const router = useRouter();
const session = useSessionStore();
const { info } = useSystemStore();
const actionsStore = useActionsStore();

// Функция для проверки условия
const evaluateCondition = (
  condition: string,
  context: Record<string, any>,
): boolean => {
  try {
    const func = new Function(...Object.keys(context), `return ${condition};`);
    return func(...Object.values(context));
  } catch (error) {
    console.error('Error evaluating condition:', error);
    return false;
  }
};

// Вычисляем роль пользователя
const userRole = computed(() => {
  const role = session.isChairman ? 'chairman' : session.isMember ? 'member' : 'user';

  return role;
});

// Контекст для evaluateCondition и проверки ролей
const context = computed(() => {
  const isCoop =
    session.currentUserAccount?.private_account?.type === Zeus.AccountType.organization &&
    session.currentUserAccount?.private_account?.organization_data &&
    'type' in session.currentUserAccount?.private_account?.organization_data &&
    session.currentUserAccount?.private_account?.organization_data.type.toUpperCase() ===
      Zeus.OrganizationType.COOP;

  // Проверка скрытия онбординга председателя
  const isOnboardingHidden = localStorage.getItem('chairman-onboarding-hidden') === 'true';

  const ctx = {
    isCoop,
    userRole: userRole.value,
    userAccount: session.currentUserAccount?.private_account,
    coopname: info.coopname,
    isOnboardingHidden,
  };

  return ctx;
});

// Используем активный второй уровень из store
const filteredRoutes = computed<IRoute[]>(() => {
  const activeRoutes = desktop.activeSecondLevelRoutes as unknown as IRoute[];


  const wsName = desktop.activeWorkspaceName ?? '';
  const filtered = activeRoutes.filter((r) => {
    // Видимость пункта — канон авторизации (grants) с fallback на legacy roles,
    // единая логика в DesktopStore.isPageVisible. Поверх — conditions и hidden.
    const accessMatch = desktop.isPageVisible(r.meta as any, wsName);
    const conditionMatch = r.meta?.conditions
      ? evaluateCondition(r.meta.conditions, context.value)
      : true;
    const hiddenMatch = r.meta?.hidden ? !r.meta.hidden : true;

    return accessMatch && conditionMatch && hiddenMatch;
  });

  return filtered;
});

// Функция для получения паттерна группы маршрутов
const getRoutePattern = (routeName: string): string | null => {
  // Для проектов
  if (routeName === 'projects-list') {
    return 'project-';
  }
  // Для других групп можно добавить аналогичные паттерны
  // if (routeName === 'tasks-list') return 'task-';
  // if (routeName === 'components-list') return 'component-';

  return null;
};

// Проверка активного маршрута
const isActive = (routeToCheck: IRoute) => {
  const currentRoute = router.currentRoute.value;
  const currentRouteName = currentRoute.name as string;

  // Прямое совпадение имени маршрута
  if (currentRouteName === routeToCheck.name) {
    return true;
  }

  // Проверка через matched routes (предки в дереве маршрутизации)
  const matchedRoutes = currentRoute.matched;
  if (matchedRoutes.some((matchedRoute) => matchedRoute.name === routeToCheck.name)) {
    return true;
  }

  // Проверка по паттерну группы маршрутов
  const pattern = getRoutePattern(routeToCheck.name);
  if (pattern && currentRouteName?.startsWith(pattern)) {
    return true;
  }

  return false;
};

// Навигация при клике
const navigate = (routeToNavigate: IRoute) => {
  // Проверяем, есть ли действие вместо маршрута
  if (routeToNavigate.meta?.action) {
    actionsStore.executeAction(routeToNavigate.meta.action);
    // Закрываем drawer в мобильной версии после выполнения действия
    desktop.closeLeftDrawerOnMobile();
    return;
  }

  // Стандартная навигация
  router.push({
    name: routeToNavigate.name,
    params: { coopname: info.coopname },
  });

  // Закрываем drawer в мобильной версии после навигации
  desktop.closeLeftDrawerOnMobile();
};

// Ключ для принудительного перерендера при смене маршрутов
const menuKey = computed(() => {
  return filteredRoutes.value.map((route) => route.name).join('-');
});
</script>

<style>
.second-menu .q-item-label {
  font-size: 12px !important;
}

/* Анимации для входа и выхода всего меню */
.menu-enter-active {
  transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.menu-leave-active {
  transition: all 0.15s cubic-bezier(0.55, 0.06, 0.68, 0.19);
}

.menu-enter-active .menu-item {
  animation: slideInDown 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
}

.menu-leave-active .menu-item {
  animation: slideOutUp 0.2s cubic-bezier(0.55, 0.06, 0.68, 0.19) both;
}

/* Анимации для отдельных элементов */
@keyframes slideInDown {
  0% {
    transform: translateY(-30px) scale(0.95);
    opacity: 0;
  }
  60% {
    transform: translateY(5px) scale(1.02);
    opacity: 0.8;
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

@keyframes slideOutUp {
  0% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateY(-25px) scale(0.9);
    opacity: 0;
  }
}
</style>
