<template>
  <div v-if="!registeredAndloggedIn" class="signin-page">
    <SignIn>
      <template #footer>
        <BaseButton variant="ghost" size="sm" @click="goToLostKey">
          Потеряли ключ?
        </BaseButton>
        <BaseButton variant="ghost" size="sm" @click="goToSignUp">
          Нет аккаунта?
        </BaseButton>
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

const router = useRouter();
const session = useSessionStore();
const store = useRegistratorStore().state;

const registeredAndloggedIn = computed(
  () => session.isRegistrationComplete && session.isAuth && store.step === 1,
);

function goToLostKey(): void {
  void router.push({ name: 'lostkey' });
}
function goToSignUp(): void {
  void router.push({ name: 'signup' });
}
</script>

<style scoped>
.signin-page {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--p-6, 24px);
  min-height: 100%;
}
</style>
