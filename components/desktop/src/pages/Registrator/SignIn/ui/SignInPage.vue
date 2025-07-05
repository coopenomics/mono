<template lang="pug">
.row.justify-center.q-pa-sm
  .col-md-4.col-sm-6.col-xs-12
    div(v-if='!registeredAndloggedIn')
      SignIn.q-mt-lg
      .text-right
        q-btn(
          flat,
          size='sm',
          dense,
          @click='router.push({ name: "lostkey" })'
        ) потеряли ключ?
        q-btn(flat, size='sm', dense, @click='router.push({ name: "signup" })') нет аккаунта?
</template>
<script lang="ts" setup>
import { useSessionStore } from 'src/entities/Session';
import { useCurrentUser } from 'src/entities/Session';
import { SignIn } from 'src/widgets/Registrator/SignIn';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useRegistratorStore } from 'src/entities/Registrator';
const store = useRegistratorStore().state;

const router = useRouter();

const registeredAndloggedIn = computed(() => {
  return (
    useCurrentUser().isRegistrationComplete &&
    useSessionStore().isAuth &&
    store.step == 1
  );
});
</script>
