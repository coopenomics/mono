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
import { useCurrentUser } from 'src/entities/Session';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import type { IRoute } from 'src/entities/Desktop/model/types';
import { Zeus } from '@coopenomics/sdk';

const desktop = useDesktopStore();
const router = useRouter();
const user = useCurrentUser();
const { info } = useSystemStore();

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

// Контекст для evaluateCondition и проверки ролей
const context = computed(() => {
  const isCoop =
    user.privateAccount.value?.type === Zeus.AccountType.organization &&
    user.privateAccount.value?.organization_data &&
    'type' in user.privateAccount.value.organization_data &&
    user.privateAccount.value.organization_data.type ===
      Zeus.OrganizationType.COOP;
  // Роль берем из computed свойств session
  const userRole = user.isChairman
    ? 'chairman'
    : user.isMember
      ? 'member'
      : 'user';
  return {
    isCoop,
    userRole,
    userAccount: user.privateAccount.value,
    coopname: info.coopname,
  };
});

// Используем активный второй уровень из store
const filteredRoutes = computed<IRoute[]>(() => {
  return (desktop.activeSecondLevelRoutes as unknown as IRoute[]).filter(
    (r) => {
      const rolesMatch =
        r.meta?.roles?.includes(context.value.userRole) ||
        (r.meta?.roles && r.meta.roles.length === 0);
      const conditionMatch = r.meta?.conditions
        ? evaluateCondition(r.meta.conditions, context.value)
        : true;
      return rolesMatch && conditionMatch;
    },
  );
});

// Проверка активного маршрута
const isActive = (routeToCheck: IRoute) => {
  return router.currentRoute.value.name === routeToCheck.name;
};

// Навигация при клике
const navigate = (routeToNavigate: IRoute) => {
  router.push({
    name: routeToNavigate.name,
    params: { coopname: info.coopname },
  });
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
