<template lang="pug">
div
  q-step(
    :name='store.steps.WaitingRegistration',
    title='Получите решение совета о приёме Вас в пайщики кооператива',
    :done='store.isStepDone("WaitingRegistration")'
  )
    template(v-if='session?.userAccount?.status !== "failed"')
      p Ваш платеж принят. Ожидаем, когда совет рассмотрит Ваше заявление и примет решение о приёме Вас в пайщики. Это может занять до 24 часов. Вы получите уведомление, когда решение будет принято.
      span Эту страницу можно закрыть, а при необходимости, войти с другого устройства с помощью ключа доступа, который был сохранён ранее.
      Loader
    template(v-else)
      p Произошла ошибка при регистрации. Пожалуйста, обратитесь в подержку для устранения проблемы.
</template>

<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import { Loader } from 'src/shared/ui/Loader';
import { useRegistratorStore } from 'src/entities/Registrator';
import { useGraphqlSubscription, buildSubscriptionQuery } from 'src/shared/lib/composables';

const store = useRegistratorStore();
const session = useSessionStore();
const participantAccount = computed(() => session.participantAccount);

onMounted(() => {
  if (participantAccount.value && store.state.step === store.steps.WaitingRegistration) {
    store.next();
  }
});

useGraphqlSubscription({
  query: buildSubscriptionQuery('sovietDataChanged', null, ['entity', 'action']),
  onData: () => {
    if (participantAccount.value) {
      store.next();
    }
  },
});
</script>
