<template lang="pug">
.q-pa-md
  div(v-if='loading')
    q-skeleton.q-mb-md(type='rect', height='300px')
    q-skeleton.q-mb-md(type='rect', height='150px', v-for='i in 2', :key='i')

  div(v-else-if='!meet')
    .empty-state.q-pa-xl
      .empty-icon
        q-icon(name='search_off', size='64px', color='grey-5')
      .empty-text Собрание не найдено
      .empty-subtitle Проверьте правильность хеша или вернитесь к списку собраний

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
import { onMounted, ref, computed, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { MeetDetailsInfo } from 'src/widgets/Meets/MeetDetailsInfo';
import { MeetDetailsActions } from 'src/widgets/Meets/MeetDetailsActions';
import { MeetDetailsAgenda } from 'src/widgets/Meets/MeetDetailsAgenda';
import { MeetDetailsVoting } from 'src/widgets/Meets/MeetDetailsVoting';
import { MeetDetailsResults } from 'src/widgets/Meets/MeetDetailsResults';
import { useMeetStore } from 'src/entities/Meet';
import { useDesktopStore } from 'src/entities/Desktop';
import { useBackButton } from 'src/shared/lib/navigation';
import { useVoteOnMeet } from 'src/features/Meet/VoteOnMeet';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert } from 'src/shared/api';

const route = useRoute();
const meetStore = useMeetStore();
const desktopStore = useDesktopStore();

const coopname = computed(() => route.params.coopname as string);
const meetHash = computed(() => route.params.hash as string);

const meet = computed(() => meetStore.currentMeet);
const loading = ref(true);

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
const buttonText = computed(() =>
  workspace.value === 'soviet' ? 'Назад' : 'Назад',
);
const targetRouteName = computed(() =>
  workspace.value === 'soviet' ? 'meets' : 'user-meets',
);

useBackButton({
  text: buttonText.value,
  routeName: targetRouteName.value,
  params: { coopname: coopname.value },
  componentId: 'meet-details-' + meetHash.value,
});

onMounted(() => {
  loadMeetDetails();
  intervalId = setInterval(loadMeetDetails, 15000);
});

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
});
</script>

<style lang="scss" scoped>
@import 'src/shared/ui/CardStyles/index.scss';
</style>
