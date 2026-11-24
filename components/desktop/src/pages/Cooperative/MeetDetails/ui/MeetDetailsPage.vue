<template lang="pug">
.meet-details-page
  //- Canon back-link под шапкой, слева (вместо кнопки «Назад» в топбаре).
  button.meet-back(type='button', @click='goBack')
    q-icon(name='arrow_back', size='18px')
    span {{ $t('cooperative.meetDetailsPage.backLabel') }}

  //- Каркас повторяет раскладку: шапка, затем основное содержание и сведения.
  div(v-if='loading')
    span.skel.meet-skel.meet-skel--header
    .meet-layout
      span.skel.meet-skel.meet-skel--main
      span.skel.meet-skel.meet-skel--aside

  EmptyState(
    v-else-if='!meet',
    :title='$t("cooperative.meetDetailsPage.notFoundTitle")',
    :body='$t("cooperative.meetDetailsPage.notFoundBody")'
  )
    template(#icon)
      q-icon(name='search_off', size='48px')

  template(v-else)
    //- Шапка: шаг собрания и действие шага для вошедшего.
    MeetHeader.meet-details-page__header(:meet='meet')
      template(#actions)
        SignNotificationButton(
          v-if='showAgenda && canNotify',
          :coopname='coopname',
          :meetHash='meetHash'
        )
        MeetDetailsActions(
          :meet='meet',
          :coopname='coopname',
          :meet-hash='meetHash'
        )

    //- Основное содержание слева — повестка, голосование или результаты;
    //- сведения собрания справа. На узком экране — один столбец.
    .meet-layout
      .meet-layout__main
        MeetDetailsResults(v-if='showResults', :meet='meet')
        MeetDetailsVoting(
          v-else-if='isVotingNow',
          :meet='meet',
          :coopname='coopname',
          :meet-hash='meetHash'
        )
        MeetDetailsAgenda(v-else, :meet='meet')
      aside.meet-layout__aside
        MeetFacts(:meet='meet')
</template>

<script setup lang="ts">
import { onMounted, ref, computed, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MeetHeader } from 'src/widgets/Meets/MeetHeader';
import { MeetFacts } from 'src/widgets/Meets/MeetFacts';
import { SignNotificationButton } from 'src/features/Meet/SignNotification/ui';
import { MeetDetailsActions } from 'src/widgets/Meets/MeetDetailsActions';
import { MeetDetailsAgenda } from 'src/widgets/Meets/MeetDetailsAgenda';
import { MeetDetailsVoting } from 'src/widgets/Meets/MeetDetailsVoting';
import { MeetDetailsResults } from 'src/widgets/Meets/MeetDetailsResults';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { useMeetStore, MEET_LIVE_TABLES, canSignNotification } from 'src/entities/Meet';
import { useDesktopStore } from 'src/entities/Desktop';
import { useVoteOnMeet } from 'src/features/Meet/VoteOnMeet';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert } from 'src/shared/api';
import { t } from 'src/shared/i18n';
import { useLiveReload } from 'src/shared/lib/realtime';

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
  return id ? t('cooperative.meetDetailsPage.titleWithId', { id }) : t('cooperative.meetDetailsPage.defaultTitle');
});

const isProcessed = computed(() => !!meet.value?.processed);
// После закрытия голосования главное содержание — результаты: счёт голосов
// виден уже на подписании протокола, итог «принято» — после утверждения.
const AFTER_VOTING: string[] = [
  Zeus.ExtendedMeetStatus.VOTING_COMPLETED,
  Zeus.ExtendedMeetStatus.PRECLOSED,
  Zeus.ExtendedMeetStatus.EXPIRED_NO_QUORUM,
  Zeus.ExtendedMeetStatus.CLOSED,
];
const showResults = computed(
  () => isProcessed.value || AFTER_VOTING.includes(meet.value?.processing?.extendedStatus ?? ''),
);

const showAgenda = computed(
  () =>
    meet.value?.processing?.extendedStatus ===
    Zeus.ExtendedMeetStatus.WAITING_FOR_OPENING,
);

const { isVotingNow, setMeet } = useVoteOnMeet();
// Подтверждение уведомления на собрании уполномоченных — только у председателей участков.
const canNotify = computed(() => canSignNotification(meet.value));

const loadMeetDetails = async (silent = false) => {
  try {
    await meetStore.loadMeet(
      {
        coopname: coopname.value,
        hash: meetHash.value,
      },
      { silent },
    );
    if (meet.value) setMeet(meet.value);
  } catch (error: any) {
    // Фоновое перечитывание не пугает отказом: следующий сигнал повторит.
    if (!silent) FailAlert(error);
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
});

// Карточка живёт по ленте изменений вместо опроса раз в 15 секунд: голоса
// пайщиков, открытие, закрытие и подпись протокола приходят сигналом.
useLiveReload(
  MEET_LIVE_TABLES,
  () => loadMeetDetails(true),
);

onUnmounted(() => {
  desktopStore.clearPageTitleOverride();
});
</script>

<style lang="scss" scoped>
.meet-details-page__header {
  margin-bottom: var(--p-5, 20px);
}

.meet-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: var(--p-5, 20px);
  align-items: start;
}

.meet-layout__aside {
  position: sticky;
  top: var(--p-4, 16px);
}

.meet-skel {
  display: block;
  width: 100%;
  border-radius: var(--p-r-lg, 16px);
}
.meet-skel--header {
  height: 96px;
  margin-bottom: var(--p-5, 20px);
}
.meet-skel--main {
  height: 360px;
}
.meet-skel--aside {
  height: 280px;
}

@media (max-width: 1024px) {
  .meet-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  // На узком экране сведения идут первыми: явка и ведущие важнее длинной повестки.
  .meet-layout__aside {
    position: static;
    order: -1;
  }
}

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
