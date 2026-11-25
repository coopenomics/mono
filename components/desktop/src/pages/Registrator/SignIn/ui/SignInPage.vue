<template>
  <div v-if="view === 'form'" class="signin-page">
    <SignIn>
      <template #actions>
        <AuthActions />
      </template>
      <template #pane-foot> {{ $t('registrator.signInPage.notMemberPrompt') }} <a class="auth-link" href="#" @click.prevent="goToSignUp">{{ $t('registrator.signInPage.joinCoopAction') }}</a>
      </template>
      <template #footer>
        <a class="auth-link" href="#" @click.prevent="goToLostKey">{{ $t('registrator.signInPage.lostKeyPrompt') }}</a>
        <a class="auth-link" href="#" @click.prevent="goToSignUp">{{ $t('registrator.signInPage.noAccountPrompt') }}</a>
      </template>
    </SignIn>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useSessionStore } from 'src/entities/Session';
import { useRegistratorStore } from 'src/entities/Registrator';
import { SignIn } from 'src/widgets/Registrator/SignIn';
import { AuthActions } from 'src/widgets/Registrator/AuthActions';
import { useSystemStore } from 'src/entities/System/model';
import { signInViewOf } from '../model/signInView';

const router = useRouter();
const session = useSessionStore();
const store = useRegistratorStore().state;

const system = useSystemStore();

const view = computed(() =>
  signInViewOf({
    isAuth: session.isAuth,
    isFullyActive: session.isFullyActive,
    registratorStep: store.step,
  }),
);

// Принятый советом пайщик открыл вход уже вошедшим (закладка, кнопка «назад») —
// формы нет, ведём на главную: охрана маршрутов откроет его стол. Переход после
// входа на этой странице делает форма (useEnterDesktop), поэтому решение
// принимается один раз при открытии, а не по каждой смене сессии.
onMounted(() => {
  if (view.value === 'enter') {
    void router.replace({ name: 'index', params: { coopname: system.info.coopname } });
  }
});

function goToLostKey(): void {
  // CoopID-восстановление по magic-link (Эпик 12) — пришло на смену легаси-сбросу ключа.
  void router.push({ name: 'recover' });
}
function goToSignUp(): void {
  void router.push({ name: 'signup' });
}
</script>

<style scoped>
.signin-page {
  min-height: inherit;
}
</style>
