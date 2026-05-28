<template lang="pug">
div
  router-view(v-if='route.name !== "user-meets" && route.name !== "meets"')
  template(v-else)
    Teleport(v-if='canCreateMeet', to='#header-actions-host', defer)
      CreateMeetButton(:is-chairman='session.isChairman', :micro='isMobile')
    .meet-list-page
      MeetCardsList(:meets='meets', :loading='loading')
</template>

<script setup lang="ts">
import { onMounted, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { MeetCardsList } from 'src/widgets/Meets/MeetCardsList';
import { CreateMeetButton } from 'src/features/Meet/CreateMeet';
import { useMeetStore } from 'src/entities/Meet';
import { useSessionStore } from 'src/entities/Session';
import { useWindowSize } from 'src/shared/hooks';
import { FailAlert } from 'src/shared/api';

const route = useRoute();
const coopname = computed(() => route.params.coopname as string);
const meetStore = useMeetStore();
const session = useSessionStore();
const { isMobile } = useWindowSize();

// Данные напрямую из стора
const meets = computed(() => meetStore.meets);
const loading = computed(() => meetStore.loading);

// Загрузка списка собраний
const loadMeets = async () => {
  try {
    await meetStore.loadMeets({ coopname: coopname.value });
  } catch (e: any) {
    FailAlert(e);
  }
};

// Кнопку «Созвать собрание» видит член совета или председатель.
const canCreateMeet = computed(() => session.isMember || session.isChairman);

// Находимся ли на странице списка собраний (не на карточке отдельного).
const isOnMeetListPage = computed(
  () => route.name === 'user-meets' || route.name === 'meets',
);

onMounted(() => {
  if (isOnMeetListPage.value) loadMeets();
});

// При возврате на список — перезагружаем данные.
watch(
  () => route.name,
  (newRouteName) => {
    if (newRouteName === 'user-meets' || newRouteName === 'meets') loadMeets();
  },
);
</script>

<style lang="scss" scoped>
/* Полная ширина контента, как на canon-страницах документов/платежей. */
.meet-list-page {
  padding: var(--p-6, 24px);
}
@media (max-width: 768px) {
  .meet-list-page {
    padding: var(--p-4, 16px);
  }
}
</style>
