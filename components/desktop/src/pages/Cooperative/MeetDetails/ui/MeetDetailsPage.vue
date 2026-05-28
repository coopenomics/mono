<template lang="pug">
.meet-details-page
  //- Canon back-link под шапкой, слева (вместо кнопки «Назад» в топбаре).
  button.meet-back(type='button', @click='goBack')
    q-icon(name='arrow_back', size='18px')
    span К списку собраний

  div(v-if='loading')
    q-skeleton.q-mb-md.rounded-borders(type='rect', height='220px')
    q-skeleton.q-mb-md.rounded-borders(type='rect', height='140px', v-for='i in 2', :key='i')

  EmptyState(
    v-else-if='!meet',
    title='Собрание не найдено',
    body='Проверьте правильность ссылки или вернитесь к списку собраний.'
  )
    template(#icon)
      q-icon(name='search_off', size='48px')

  div(v-else)
    MeetDetailsInfo.q-mb-lg(:meet='meet')
      template(#actions)
        MeetDetailsActions(
          :meet='meet',
          :coopname='coopname',
          :meet-hash='meetHash'
        )
    template(v-if='isProcessed')
      MeetDetailsResults.q-mb-lg(:meet='meet')

    template(v-else)
      MeetDetailsAgenda.q-mb-lg(
        v-if='showAgenda',
        :meet='meet',
        :coopname='coopname',
        :meet-hash='meetHash'
      )
      MeetDetailsVoting.q-mb-lg(
        v-if='isVotingNow',
        :meet='meet',
        :coopname='coopname',
        :meet-hash='meetHash'
      )
</template>

<script setup lang="ts">
import { onMounted, ref, computed, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MeetDetailsInfo } from 'src/widgets/Meets/MeetDetailsInfo';
import { MeetDetailsActions } from 'src/widgets/Meets/MeetDetailsActions';
import { MeetDetailsAgenda } from 'src/widgets/Meets/MeetDetailsAgenda';
import { MeetDetailsVoting } from 'src/widgets/Meets/MeetDetailsVoting';
import { MeetDetailsResults } from 'src/widgets/Meets/MeetDetailsResults';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { useMeetStore } from 'src/entities/Meet';
import { useDesktopStore } from 'src/entities/Desktop';
import { useVoteOnMeet } from 'src/features/Meet/VoteOnMeet';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert } from 'src/shared/api';

const route = useRoute();
const router = useRouter();
const meetStore = useMeetStore();
const desktopStore = useDesktopStore();

const coopname = computed(() => route.params.coopname as string);
const meetHash = computed(() => route.params.hash as string);

const meet = computed(() => meetStore.currentMeet);
const loading = ref(true);

// Название собрания — в заголовок шапки (вместо «Детали собрания»).
const meetTitle = computed(() => {
  const id = meet.value?.processing?.meet?.id;
  return id ? `Общее собрание № ${id}` : 'Детали собрания';
});

const isProcessed = computed(() => !!meet.value?.processed);

const showAgenda = computed(
  () =>
    meet.value?.processing?.extendedStatus ===
    Zeus.ExtendedMeetStatus.WAITING_FOR_OPENING,
);

const { isVotingNow, setMeet } = useVoteOnMeet();

let intervalId: ReturnType<typeof setInterval> | null = null;

const loadMeetDetails = async () => {
  try {
    await meetStore.loadMeet({
      coopname: coopname.value,
      hash: meetHash.value,
    });
    if (meet.value) setMeet(meet.value);
  } catch (error: any) {
    FailAlert(error);
  } finally {
    loading.value = false;
  }
};

const workspace = computed(() => desktopStore.activeWorkspaceName);
const targetRouteName = computed(() =>
  workspace.value === 'soviet' ? 'meets' : 'user-meets',
);

// Возврат к списку собраний (back-link под шапкой).
const goBack = (): void => {
  void router.push({
    name: targetRouteName.value,
    params: { coopname: coopname.value },
  });
};

// Имя собрания держим в заголовке шапки, пока открыта страница.
watch(
  meetTitle,
  (title) => desktopStore.setPageTitleOverride(title),
  { immediate: true },
);

onMounted(() => {
  loadMeetDetails();
  intervalId = setInterval(loadMeetDetails, 15000);
});

onUnmounted(() => {
  desktopStore.clearPageTitleOverride();
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
});
</script>

<style lang="scss" scoped>
/* Полная ширина контента, как на canon-страницах документов/платежей. */
.meet-details-page {
  padding: var(--p-6, 24px);
}
@media (max-width: 768px) {
  .meet-details-page {
    padding: var(--p-4, 16px);
  }
}

.meet-back {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1, 4px);
  margin-bottom: var(--p-4, 16px);
  padding: 0;
  border: none;
  background: transparent;
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
  cursor: pointer;
  transition: color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.meet-back:hover {
  color: var(--p-ink);
}
</style>
