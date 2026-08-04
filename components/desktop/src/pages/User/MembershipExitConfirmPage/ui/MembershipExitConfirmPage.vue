<template lang="pug">
.membership-exit-confirm.row.justify-center
  .col-12.col-md-6.text-center.q-pt-xl
    template(v-if='loading')
      q-spinner(size='56px', color='primary')
      div.text-h6.q-mt-md Подтверждаем выход из кооператива…

    template(v-else-if='error')
      q-icon(name='error_outline', size='56px', color='negative')
      div.text-h6.q-mt-md Не удалось подтвердить выход
      p.text-body2.text-grey-7.q-mt-sm {{ error }}
      BaseButton.q-mt-lg(
        variant='secondary',
        :label='isAuth ? "Вернуться в кабинет" : "Войти в кабинет"',
        @click='goToCabinet'
      )

    template(v-else)
      q-icon(name='check_circle', size='56px', color='positive')
      div.text-h6.q-mt-md Выход подтверждён
      p.text-body2.text-grey-7.q-mt-sm Заявление отправлено. Процесс выхода запущен — ожидайте решения Совета.
      p.text-body2.text-grey-7.q-mt-sm(v-if='!isAuth') Войдите в кабинет, чтобы следить за статусом заявления и суммой возврата.
      BaseButton.q-mt-lg(
        variant='primary',
        :label='isAuth ? "Перейти в кабинет" : "Войти в кабинет"',
        @click='goToCabinet'
      )
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { useMembershipExit, useExitGate } from 'src/features/Membership/ExitFromCoop';

const route = useRoute();
const router = useRouter();
const { info } = useSystemStore();
const session = useSessionStore();
const { confirmExit } = useMembershipExit();
const { loadExitStatus } = useExitGate();

const loading = ref(true);
const error = ref<string | null>(null);

// Ссылка-подтверждение приходит на e-mail и часто открывается там, где сессии
// кабинета нет (другой браузер/инкогнито/после выхода). Подтверждение работает
// по токену и без входа, но кабинет (wallet) защищён — без сессии навигационный
// гард молча кинет на логин. Поэтому ведём явно: есть сессия → в кабинет (там
// глобальный ExitOverlay сам покажет «на рассмотрении Совета»); нет — на вход.
const isAuth = computed(() => session.isAuth);

const goToCabinet = (): void => {
  if (session.isAuth) {
    router.replace({ name: 'wallet', params: { coopname: info.coopname } });
  } else {
    router.replace({ name: 'signin', params: { coopname: info.coopname } });
  }
};

onMounted(async () => {
  const token = String(route.query.token || '');
  if (!token) {
    error.value = 'Ссылка некорректна: отсутствует токен подтверждения.';
    loading.value = false;
    return;
  }
  try {
    await confirmExit(token);
    await loadExitStatus();
  } catch (e: any) {
    error.value =
      e?.message || 'Ссылка недействительна или срок её действия истёк. Подайте заявление заново.';
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped lang="scss">
.membership-exit-confirm {
  padding: var(--p-6, 24px);
}
</style>
