<template lang="pug">
//- Встречный путь на экранах входа и вступления: со входа и восстановления —
//- «Регистрация», со вступления — «Вход». Логика та же, что была в общей шапке.
BaseButton(v-if='showRegister && !isSignup', variant='primary', size='sm', @click='signup') {{ $t('registrator.authActions.register') }}
BaseButton(v-else-if='showRegister && isSignup', variant='primary', size='sm', @click='login') {{ $t('registrator.authActions.login') }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import config from 'src/app/config';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { BaseButton } from 'src/shared/ui/base/BaseButton';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const systemStore = useSystemStore();

const showRegister = computed(() => !session.isAuth && config.registrator.showRegisterButton);
const isSignup = computed(() => route.name === 'signup');

function signup(): void {
  void router.push({ name: 'signup', params: { coopname: systemStore.info.coopname } });
}
function login(): void {
  void router.push({ name: 'signin', params: { coopname: systemStore.info.coopname } });
}
</script>
