<template lang="pug">
div
  router-view(v-if='$route.name !== "user-meets" && $route.name !== "meets"')
  template(v-else)
    .q-pa-md
      .row
        .col-12
          MeetCardsList(:meets='meets', :loading='loading')
</template>

<script setup lang="ts">
import { onMounted, computed, watch, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { MeetCardsList } from 'src/widgets/Meets/MeetCardsList';
import { CreateMeetButton } from 'src/features/Meet/CreateMeet';
import { useMeetStore } from 'src/entities/Meet';
import { useCurrentUser } from 'src/entities/Session';
import { useHeaderActions } from 'src/shared/hooks';
import { FailAlert } from 'src/shared/api';

const route = useRoute();
const coopname = computed(() => route.params.coopname as string);
const meetStore = useMeetStore();

const { isChairman, isMember } = useCurrentUser();

// Данные напрямую из стора
const meets = computed(() => meetStore.meets);
const loading = computed(() => meetStore.loading);

// Инжектим кнопку создания собрания в заголовок
const { registerAction, unregisterAction } = useHeaderActions();

// ID кнопки создания собрания
const CREATE_MEET_BUTTON_ID = 'create-meet';

// Загрузка списка собраний
const loadMeets = async () => {
  try {
    await meetStore.loadMeets({ coopname: coopname.value });
  } catch (e: any) {
    FailAlert(e);
  }
};

// Проверка разрешений
const canCreateMeet = computed(() => {
  return isMember || isChairman;
});

// Функция для регистрации кнопки
const registerCreateMeetButton = () => {
  if (canCreateMeet.value) {
    registerAction({
      id: CREATE_MEET_BUTTON_ID,
      component: CreateMeetButton,
      props: {
        isChairman: isChairman,
      },
      order: 1,
    });
  }
};

// Функция для удаления кнопки
const unregisterCreateMeetButton = () => {
  unregisterAction(CREATE_MEET_BUTTON_ID);
};

// Проверяем, находимся ли на странице списка собраний
const isOnMeetListPage = computed(() => {
  return route.name === 'user-meets' || route.name === 'meets';
});

// Загрузка данных при монтировании компонента
onMounted(() => {
  if (isOnMeetListPage.value) {
    loadMeets();
    registerCreateMeetButton();
  }
});

// Следим за изменениями маршрута
watch(
  () => route.name,
  (newRouteName) => {
    const isNowOnListPage =
      newRouteName === 'user-meets' || newRouteName === 'meets';

    if (isNowOnListPage) {
      // Переходим на страницу списка - загружаем данные и добавляем кнопку
      loadMeets();
      registerCreateMeetButton();
    } else {
      // Переходим на страницу отдельного собрания - убираем кнопку
      unregisterCreateMeetButton();
    }
  },
);

// Очищаем кнопку при размонтировании компонента
onUnmounted(() => {
  unregisterCreateMeetButton();
});
</script>
