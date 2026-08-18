<template lang="pug">
div
  // Лоадер пока идет предзагрузка пользователя
  WindowLoader(v-if="isLoading", text="Загрузка данных участника...")

  // Показываем онбординг если он не завершен и пользователь председатель
  CapitalOnboardingCard(
    v-else-if="shouldShowOnboarding"
  )
  // Показываем сообщение для обычных участников если контракт не активирован
  InfoCard(
    v-else-if="shouldShowContractNotActivatedMessage"
    text="Программа еще не активирована. Только председатель может завершить настройку системы."
  )
  // Основной контент после загрузки
  router-view(v-else)

</template>

<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { WindowLoader } from 'src/shared/ui/Loader';
import InfoCard from 'src/shared/ui/InfoCard.vue';
import { registerMenuSubItems, unregisterMenuSubItems } from 'src/shared/hooks/useMenuSubItems';
import type { RailItem } from 'src/shared/ui/layout/AppDrawer';
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model';
import { useConfigStore } from 'app/extensions/capital/entities/Config/model';
import { useFavoritesStore } from 'app/extensions/capital/entities/Favorite';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { CapitalOnboardingCard } from 'app/extensions/capital/features/Onboarding/ui';
import { useCapitalOnboarding } from 'app/extensions/capital/features/Onboarding/model';
const isLoading = ref(true);

const router = useRouter();
const route = useRoute();
const session = useSessionStore()
const system = useSystemStore();
const contributorStore = useContributorStore();
const configStore = useConfigStore();
const { isOnboardingCompleted, loadState } = useCapitalOnboarding();
const favoritesStore = useFavoritesStore();

// --- Избранное в левом меню: суб-пункты под «Проекты» / «Компоненты» / «Задачи».
// Регистрация живёт в корне стола (не в страницах): меню смонтировано постоянно,
// а состав пунктов обновляется сам — источники computed поверх favoritesStore.
const FAVORITE_MENU_SOURCES: Array<{
  parent: string;
  type: Zeus.CapitalFavoriteTargetType;
  route: (hash: string) => { name: string; params: Record<string, string> };
}> = [
  {
    parent: 'projects-list',
    type: Zeus.CapitalFavoriteTargetType.PROJECT,
    route: (hash) => ({
      name: 'project-description',
      params: { coopname: system.info.coopname, project_hash: hash },
    }),
  },
  {
    parent: 'components-list',
    type: Zeus.CapitalFavoriteTargetType.COMPONENT,
    route: (hash) => ({
      name: 'cmp-component-description',
      params: { coopname: system.info.coopname, project_hash: hash },
    }),
  },
  {
    parent: 'capital-my-tasks',
    type: Zeus.CapitalFavoriteTargetType.ISSUE,
    route: (hash) => ({
      name: 'my-task-issue-description',
      params: { coopname: system.info.coopname, issue_hash: hash },
    }),
  },
  {
    // Отдельной страницы артефакта пока нет — избранный артефакт ведёт в список
    parent: 'artifacts-list',
    type: Zeus.CapitalFavoriteTargetType.ARTIFACT,
    route: () => ({
      name: 'artifacts-list',
      params: { coopname: system.info.coopname },
    }),
  },
];

for (const source of FAVORITE_MENU_SOURCES) {
  registerMenuSubItems(
    source.parent,
    computed<RailItem[]>(() =>
      favoritesStore.favorites
        .filter((f) => f.target_type === source.type)
        .map((f) => ({
          key: `favorite:${f.target_type}:${f.target_hash}`,
          label: f.title,
          route: source.route(f.target_hash),
        })),
    ),
  );
}

onBeforeUnmount(() => {
  for (const source of FAVORITE_MENU_SOURCES) {
    unregisterMenuSubItems(source.parent);
  }
});

// Проверка полной регистрации
// Участник считается полностью зарегистрированным только при статусе 'active'
// Статус 'import' означает импортированного участника, который должен завершить регистрацию
// Статус 'pending' означает ожидание одобрения договора
const isFullyRegistered = computed(() => {
  return contributorStore.isContributorActiveOrPending;
});

// Проверка завершения онбординга благороста
const isCapitalOnboardingCompleted = isOnboardingCompleted;

// Показываем онбординг если:
// 1. Пользователь аутентифицирован
// 2. Пользователь является председателем
// 3. Онбординг благороста не завершен
// 4. Онбординг шагов не завершен
const shouldShowOnboarding = computed(() => {
  return session.isAuth &&
         session.isChairman &&
         !isCapitalOnboardingCompleted.value &&
         !isOnboardingCompleted.value
});

// Показываем сообщение для обычных участников если:
// 1. Пользователь аутентифицирован
// 2. Онбординг благороста не завершен
// 3. Пользователь НЕ является председателем
const shouldShowContractNotActivatedMessage = computed(() => {
  return session.isAuth &&
         !isCapitalOnboardingCompleted.value &&
         !session.isChairman
});

// Функция перенаправления на регистрацию (только для аутентифицированных пользователей)
// ОСОБОЕ РЕШЕНИЕ: председателю разрешаем заходить только на страницу 'contributors'
const redirectToRegistration = () => {
  if (session.isAuth && !isFullyRegistered.value && route.name !== 'capital-registration' && (!session.isChairman || route.name !== 'contributors')) {
    router.replace({ name: 'capital-registration' });
  }
};

onMounted(async () => {
  // Загружаем данные пользователя
  await contributorStore.loadSelf({username: session.username});

  // Загружаем конфигурацию контракта
  await configStore.loadState({coopname: system.info.coopname});

  // Загружаем состояние онбординга
  await loadState();

  // Избранное — не блокирует вход на стол
  favoritesStore
    .loadFavorites({ coopname: system.info.coopname, username: session.username })
    .catch((e) => console.error('Не удалось загрузить избранное:', e));

  // Проверяем необходимость редиректа на регистрацию
  redirectToRegistration();

  isLoading.value = false;
});

// Следим за изменениями маршрута и перенаправляем на регистрацию если необходимо
watch(() => route.name, () => {
  redirectToRegistration();
});
</script>
