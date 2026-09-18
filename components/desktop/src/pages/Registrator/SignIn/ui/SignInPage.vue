<template>
  <div v-if="!registeredAndloggedIn" class="signin-page">
    <SignIn>
      <template #actions>
        <AuthActions />
      </template>
      <template #pane-foot>
        Ещё не пайщик?
        <a class="auth-link" href="#" @click.prevent="goToSignUp">Вступить в кооператив</a>
      </template>
      <template #footer>
        <a class="auth-link" href="#" @click.prevent="goToLostKey">Потеряли ключ?</a>
        <a class="auth-link" href="#" @click.prevent="goToSignUp">Нет аккаунта?</a>
      </template>
    </SignIn>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useSessionStore } from 'src/entities/Session';
import { useRegistratorStore } from 'src/entities/Registrator';
import { SignIn } from 'src/widgets/Registrator/SignIn';
import { AuthActions } from 'src/widgets/Registrator/AuthActions';

const router = useRouter();
const session = useSessionStore();
const store = useRegistratorStore().state;

const registeredAndloggedIn = computed(
  () => session.isRegistrationComplete && session.isAuth && store.step === 1,
);

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
