<template lang="pug">
AuthSplit(
  :eyebrow='coopTitle',
  :title='LOGIN_PANE.title',
  :lead='LOGIN_PANE.lead',
  :quote='LOGIN_PANE.quote',
  step-eyebrow='Вход',
  :heading='title',
  :text='subtitle'
)
  LoginForm(@step-change='step = $event')
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { LoginForm } from 'src/features/User/LoginUser/ui/LoginForm';
import { LOGIN_PANE, useLoginStepHeading } from 'src/features/User/LoginUser';
import { useSystemStore } from 'src/entities/System/model';
import { AuthSplit } from 'src/shared/ui/layout/AuthSplit';
import { setSsrStatus } from 'src/shared/lib/ssr/setSsrStatus';

// Страница входа вместо запрошенной при серверном рендере — честный 401.
setSsrStatus(401);

const systemStore = useSystemStore();
const coopTitle = computed(() => systemStore.cooperativeDisplayName);

const { step, title, subtitle } = useLoginStepHeading({
  title: 'Войдите, чтобы продолжить',
  subtitle: 'Запрошенная страница доступна только пайщикам.',
});
</script>
